import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

interface PushPayload {
  userId: string
  title?: string
  message?: string
  url?: string
  requestId?: string
}

interface NotificationContent {
  title: string
  message: string
  url: string
  requestId: string | null
}

async function sendOneSignalNotification(
  externalId: string,
  payload: NotificationContent,
): Promise<number> {
  const appId = Deno.env.get('ONESIGNAL_APP_ID')
  const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY')
  if (!appId || !apiKey) {
    throw new Error('Configure ONESIGNAL_APP_ID e ONESIGNAL_REST_API_KEY nos secrets da Edge Function.')
  }

  const response = await fetch('https://api.onesignal.com/notifications?c=push', {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: appId,
      include_aliases: { external_id: [externalId] },
      target_channel: 'push',
      headings: { en: payload.title, pt: payload.title },
      contents: { en: payload.message, pt: payload.message },
      data: {
        url: payload.url,
        requestId: payload.requestId ?? '',
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`OneSignal API respondeu ${response.status}: ${await response.text()}`)
  }

  const result = await response.json()
  return typeof result.recipients === 'number' ? result.recipients : 1
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { headers: corsHeaders, status })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Método não permitido. Use POST.' }, 405)
  }

  try {
    const authorization = req.headers.get('Authorization')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!authorization) {
      return jsonResponse({ success: false, error: 'Autenticação obrigatória.' }, 401)
    }
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error('Configuração Supabase necessária ausente na Edge Function.')
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) {
      return jsonResponse({ success: false, error: 'Sessão inválida ou expirada.' }, 401)
    }
    const caller = authData.user

    let payload: PushPayload
    try {
      payload = await req.json()
    } catch {
      return jsonResponse({ success: false, error: 'Payload JSON inválido.' }, 400)
    }
    const { userId, requestId } = payload
    if (typeof userId !== 'string' || !userId.trim()) {
      return jsonResponse({ success: false, error: 'Campo "userId" é obrigatório.' }, 400)
    }

    if (caller.id !== userId) {
      if (typeof requestId !== 'string' || !requestId.trim()) {
        return jsonResponse({ success: false, error: 'requestId é obrigatório para notificar outro usuário.' }, 403)
      }

      const { data: request, error: requestError } = await userClient
        .from('service_requests')
        .select('customer_id, provider_id, status')
        .eq('id', requestId)
        .maybeSingle()
      if (requestError) {
        throw new Error(`Não foi possível validar a solicitação: ${requestError.message}`)
      }
      if (
        !request ||
        String(request.customer_id) !== userId ||
        String(request.provider_id) !== caller.id ||
        !['accepted', 'aceite'].includes(String(request.status).toLowerCase())
      ) {
        return jsonResponse({ success: false, error: 'Não autorizado a notificar este usuário.' }, 403)
      }
    }

    const deliveryClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: subscription, error: subscriptionError } = await deliveryClient
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)
      .maybeSingle()
    if (subscriptionError) {
      throw new Error(`Erro ao buscar subscription Web Push: ${subscriptionError.message}`)
    }

    const notification: NotificationContent = {
      title: typeof payload.title === 'string' && payload.title.trim() ? payload.title : 'KuidaCar',
      message: typeof payload.message === 'string' && payload.message.trim() ? payload.message : 'Nova notificação',
      url: typeof payload.url === 'string' && payload.url.trim() ? payload.url : '/',
      requestId: typeof requestId === 'string' ? requestId : null,
    }
    const webPayload = JSON.stringify({
      title: notification.title,
      message: notification.message,
      url: notification.url,
      requestId: notification.requestId,
      timestamp: new Date().toISOString(),
    })
    const deliveryErrors: string[] = []
    let sentCount = 0

    if (subscription) {
      try {
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
        if (!vapidPrivateKey || !vapidPublicKey) {
          throw new Error('VAPID_PRIVATE_KEY e VAPID_PUBLIC_KEY devem estar configuradas.')
        }

        webpush.setVapidDetails('mailto:admin@kuidacar.com', vapidPublicKey, vapidPrivateKey)
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, webPayload)
        sentCount++
      } catch (error) {
        const webPushError = error as { message?: string; statusCode?: number }
        if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
          const { error: deleteError } = await deliveryClient
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
          if (deleteError) {
            console.error('Erro ao remover subscription Web Push expirada:', deleteError.message)
          }
        } else {
          deliveryErrors.push(`Web Push: ${webPushError.message ?? String(error)}`)
        }
      }
    }

    try {
      sentCount += await sendOneSignalNotification(userId, notification)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      deliveryErrors.push(`OneSignal: ${message}`)
    }

    if (sentCount === 0) {
      if (!subscription && deliveryErrors.some((error) => error.includes('ONESIGNAL_APP_ID'))) {
        return jsonResponse({
          success: false,
          error: deliveryErrors.join('; '),
          code: 'PUSH_PROVIDER_NOT_CONFIGURED',
        }, 500)
      }
      if (deliveryErrors.length === 0) {
        return jsonResponse({
          success: false,
          message: 'Nenhum dispositivo inscrito para receber notificações.',
          code: 'NO_SUBSCRIPTION',
        })
      }
      throw new Error(deliveryErrors.join('; '))
    }

    const { error: logError } = await deliveryClient
      .from('push_notification_logs')
      .insert({
        user_id: userId,
        title: notification.title,
        message: notification.message,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
    if (logError) console.warn('Não foi possível registrar o envio:', logError.message)

    return jsonResponse({
      success: true,
      message: 'Notificação enviada.',
      userId,
      sentCount,
      deliveryErrors,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Erro na Edge Function send-push-notification: ${message}`)
    return jsonResponse({
      success: false,
      error: message,
      code: 'INTERNAL_ERROR',
    }, 500)
  }
})
