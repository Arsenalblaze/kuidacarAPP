# Edge Function: send-push-notification

Envia notificações push usando **Web Push + VAPID** para navegadores e **OneSignal** para Android nativo.

## 📋 Visão Geral

Esta Edge Function funciona em conjunto com:
- `usePushNotifications.ts` (hook React para gerenciar subscriptions)
- `sw.js` e tabela `push_subscriptions` para Web Push
- OneSignal usando o ID Supabase do usuário como `external_id` no Android

## 🔧 Como Funciona

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React)                                             │
│ └─ usePushNotifications.ts                                  │
│    └─ Registra Service Worker                               │
│    └─ Obtém permissão de notificações                       │
│    └─ Cria subscription (endpoint + keys)                   │
│    └─ Salva em push_subscriptions table                     │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend (Sua API / Server)                                   │
│ └─ Quando um evento importante acontece:                    │
│    └─ Chama supabase.functions.invoke('send-push-notification', { │
│       userId,                                                │
│       title,                                                 │
│       message,                                               │
│       url                                                    │
│    })                                                        │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Edge Function: send-push-notification                        │
│ ├─ Busca subscription do usuário em push_subscriptions      │
│ ├─ Configura VAPID (Public + Private keys)                  │
│ ├─ Usa web-push para enviar notificação REAL                │
│ └─ Trata erros (subscription expirada, etc)                 │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Supabase Edge Function -> OneSignal (mobile) / Web Push      │
│ └─ Entrega notificação real ao navegador/telefone          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Service Worker (sw.js)                                      │
│ └─ Recebe notificação                                        │
│ └─ Exibe para o usuário                                     │
│ └─ Trata cliques (abre URL, etc)                            │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Payload Esperado

```json
{
  "userId": "uuid-do-usuario",
  "title": "Nova Solicitação",
  "message": "Você recebeu uma nova solicitação de serviço",
  "url": "/request/123",
  "requestId": "request-123"
}
```

## 📊 Tabelas Necessárias

### 1. `push_subscriptions` (armazena endpoints)

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
```

### 2. `push_notification_logs` (opcional, para auditoria)

```sql
CREATE TABLE IF NOT EXISTS push_notification_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  title TEXT,
  message TEXT,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_notification_logs_user_id ON push_notification_logs(user_id);
```

## 🔐 Configuração VAPID

### 1. Gerar Chaves VAPID

**Opção A:** Usar o script fornecido

```bash
node generate-vapid-keys.js
```

**Opção B:** Gerar manualmente (Node.js)

```bash
npm install web-push
npx web-push generate-vapid-keys
```

Você receberá uma chave pública e uma chave privada. A chave privada é secreta: não a inclua no código, frontend, documentação versionada ou repositório.

### 2. Adicionar Secrets no Supabase

No **Supabase Dashboard → Project Settings → Secrets**:

Para push nativo via OneSignal, adicione também:

1. **ONESIGNAL_APP_ID** — App ID do projeto OneSignal.
2. **ONESIGNAL_REST_API_KEY** — App API Key do OneSignal. Mantenha esta chave apenas nos secrets da Edge Function.

O App ID do cliente deve ser configurado como `VITE_ONESIGNAL_APP_ID` no ambiente de build do app. O push web continua a usar as chaves VAPID abaixo.

1. **VAPID_PUBLIC_KEY**
   - Valor: Copie a chave pública completa
   - Descrição: Chave pública VAPID para notificações push

2. **VAPID_PRIVATE_KEY**
   - Valor: Copie a chave privada completa
   - Descrição: Chave privada VAPID para notificações push

**⚠️ IMPORTANTE:**
- Guarde estas chaves em local seguro
- Nunca compartilhe a chave privada
- Use a mesma chave para o mesmo projeto

### 3. Configurar o cliente

Para Web Push, a chave pública configurada no cliente em `src/app/hooks/usePushNotifications.ts` precisa corresponder a `VAPID_PUBLIC_KEY`. Ela pode ser pública; mantenha `VAPID_PRIVATE_KEY` apenas nos secrets do Supabase.

Para Android, configure `VITE_ONESIGNAL_APP_ID` no ambiente de build e os secrets `ONESIGNAL_APP_ID` e `ONESIGNAL_REST_API_KEY` na Edge Function. Nunca exponha a REST API Key no app.

## 🚀 Deployment

### 1. Fazer Upload da Function

```bash
# Opção 1: Usar Supabase CLI
supabase functions deploy send-push-notification

# Opção 2: Via GitHub Actions (se configurado)
# Commit e push para main/deploy
```

### 2. Testar a Função

```bash
# URL da função
https://YOUR_PROJECT_ID.functions.supabase.co/send-push-notification

# Request de teste
curl -X POST https://YOUR_PROJECT_ID.functions.supabase.co/send-push-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "userId": "user-uuid",
    "title": "Teste",
    "message": "Isso é um teste de notificação push!",
    "url": "/"
  }'
```

## 💻 Usar no Frontend

### Exemplo 1: Enviar Notificação Manualmente

```typescript
import { supabase } from '@/app/utils/api';

const sendTestNotification = async (userId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId,
        title: 'Teste de Notificação',
        message: 'Esta é uma notificação de teste!',
        url: '/dashboard'
      }
    });

    if (error) {
      console.error('Erro ao enviar notificação:', error);
      return;
    }

    console.log('Notificação enviada:', data);
  } catch (err) {
    console.error('Erro:', err);
  }
};
```

### Exemplo 2: Integração com Sistema de Solicitações

```typescript
// Quando uma solicitação é criada/aceita
const onRequestAccepted = async (requestId: string, customerId: string) => {
  try {
    // Notificar o cliente
    await supabase.functions.invoke('send-push-notification', {
      body: {
        userId: customerId,
        title: 'Solicitação Aceita! ✅',
        message: 'Um mecânico aceitou sua solicitação de serviço',
        url: `/request/${requestId}`,
        requestId
      }
    });
  } catch (error) {
    console.error('Erro ao notificar cliente:', error);
  }
};
```

## 📝 Estrutura de Resposta

### Sucesso ✅

```json
{
  "success": true,
  "message": "Notificação enviada com sucesso",
  "userId": "user-uuid",
  "title": "Nova Solicitação",
  "message": "..."
}
```

### Sem Subscription (Esperado)

```json
{
  "success": false,
  "message": "Usuário não tem push subscription ativa",
  "code": "NO_SUBSCRIPTION"
}
```

### Subscription Expirada

```json
{
  "success": false,
  "message": "Subscription expirada e removida",
  "code": "SUBSCRIPTION_EXPIRED",
  "statusCode": 410
}
```

### Erro

```json
{
  "success": false,
  "error": "Mensagem de erro",
  "code": "INTERNAL_ERROR"
}
```

## 🐛 Troubleshooting

### ❌ "VAPID_PRIVATE_KEY não configurada"

**Solução:**
1. Vá ao Supabase Dashboard → Project Settings → Secrets
2. Verifique se `VAPID_PRIVATE_KEY` existe
3. Se não, crie-a com a chave privada gerada

### ❌ "Nenhuma subscription encontrada"

**Possíveis causas:**
- Usuário não subscreveu a notificações
- Service Worker não foi registrado
- Permissão de notificação foi negada
- Subscription foi removida

**Solução:**
1. No frontend, chame `usePushNotifications().subscribeToPush()`
2. Verifique se Service Worker está rodando
3. Confirme permissão em Settings → Notifications

### ❌ "Subscription expirada" (410)

**Causa:** Subscription de 24-90 dias expirou

**Solução:** 
- Reinscrever o usuário (chamar `subscribeToPush()` novamente)
- Função remove automaticamente a subscription expirada

### ❌ Notificação não aparece

**Causas possíveis:**
- Service Worker não registrado
- Browser aberto mas tab em background
- Configuração de permissão incorreta

**Debug:**
```javascript
// No DevTools console
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Registrações:', registrations);
});
```

## 📚 Arquivos Relacionados

```
src/
├── app/
│   ├── hooks/
│   │   └── usePushNotifications.ts        ← Hook para gerenciar subscriptions
│   └── utils/
│       └── api.ts                          ← Cliente API Supabase
├── public/
│   └── sw.js                               ← Service Worker (recebe notificações)
└── styles/
    └── index.css                           ← CSS global

supabase/
├── functions/
│   └── send-push-notification/
│       ├── index.ts                        ← Esta função
│       └── README.md                       ← Este arquivo
└── config.toml                             ← Config do Supabase

generate-vapid-keys.js                      ← Gera chaves VAPID
```

## ✅ Checklist de Setup

- [ ] Tabelas criadas (`push_subscriptions`, `push_notification_logs`)
- [ ] VAPID Keys geradas
- [ ] `VAPID_PUBLIC_KEY` adicionada ao frontend
- [ ] `VAPID_PRIVATE_KEY` adicionada ao Supabase Secrets
- [ ] Edge Function deployada
- [ ] Service Worker (sw.js) registrado
- [ ] `usePushNotifications.ts` implementado
- [ ] Permissão de notificações solicitada ao usuário
- [ ] Função testada com sucesso

## 🔗 Referências

- [Web Push Spec](https://www.w3.org/TR/push-api/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notification)
- [web-push (NPM)](https://www.npmjs.com/package/web-push)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
