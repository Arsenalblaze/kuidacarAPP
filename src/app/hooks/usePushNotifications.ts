import { useEffect, useState } from 'react';
import { isAndroidNativeApp, initializeOneSignal, OneSignal, syncOneSignalIdentity } from '../utils/oneSignal';
import { supabase } from '../utils/api';

type PushSubscriptionState = PushSubscription | string | null;

export const usePushNotifications = (userId: string | null) => {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscriptionState>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    let active = true;

    const syncPermission = async () => {
      if (isAndroidNativeApp()) {
        setIsSupported(true);
        try {
          await initializeOneSignal();
          if (userId) {
            await syncOneSignalIdentity(userId);
          }
          const [hasPermission, canRequestPermission, optedIn] = await Promise.all([
            OneSignal.Notifications.hasPermission(),
            OneSignal.Notifications.canRequestPermission(),
            OneSignal.User.pushSubscription.getOptedInAsync()
          ]);
          if (active) {
            setPermission(hasPermission ? 'granted' : canRequestPermission ? 'default' : 'denied');
            setSubscription(optedIn && userId ? `onesignal:${userId}` : null);
          }
        } catch (error) {
          console.error('Erro ao verificar notificações OneSignal:', error);
        }
        return;
      }

      if (
        typeof navigator !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        typeof Notification !== 'undefined'
      ) {
        setIsSupported(true);
        setPermission(Notification.permission);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncPermission();
      }
    };

    void syncPermission();
    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId]);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('Service Worker registrado:', registration);
      return registration;
    } catch (error) {
      console.error('Erro ao registrar Service Worker:', error);
      throw error;
    }
  };

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (isAndroidNativeApp()) {
      try {
        await initializeOneSignal();
        const granted = await OneSignal.Notifications.requestPermission(false);
        const result: NotificationPermission = granted ? 'granted' : 'denied';
        setPermission(result);
        return result;
      } catch (error) {
        console.error('Erro ao pedir permissão de notificações OneSignal:', error);
        throw error;
      }
    }

    if (typeof Notification === 'undefined') {
      throw new Error('Notificações não são suportadas neste navegador.');
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      console.error('Erro ao pedir permissão:', error);
      throw error;
    }
  };

  const subscribeToPush = async () => {
    if (isAndroidNativeApp()) {
      if (!userId) {
        throw new Error('Faça login para ativar notificações push.');
      }

      await syncOneSignalIdentity(userId);
      const result = permission === 'granted'
        ? 'granted'
        : await requestPermission();
      if (result !== 'granted') {
        throw new Error('Permissão para notificações negada.');
      }

      await OneSignal.User.pushSubscription.optIn();
      setSubscription(`onesignal:${userId}`);
      return `onesignal:${userId}`;
    }

    try {
      const registration = await registerServiceWorker();
      const vapidPublicKey = 'BDxN_mgX1K-CXJGp1EQBFF8b85CZHlSULu4eC08IO9EPJVhuQKn5eLn1ykgFUTm4Sf6qcjWrqY6PjYj9cQYfd8k';
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      setSubscription(pushSubscription);
      console.log('Push subscription criada:', pushSubscription);

      if (userId) {
        await saveSubscriptionToSupabase(pushSubscription, userId);
      }

      return pushSubscription;
    } catch (error) {
      console.error('Erro ao subscrever push:', error);
      throw error;
    }
  };

  const unsubscribeFromPush = async () => {
    try {
      if (isAndroidNativeApp()) {
        await initializeOneSignal();
        await OneSignal.User.pushSubscription.optOut();
        setSubscription(null);
        return;
      }

      if (subscription && typeof subscription !== 'string') {
        await subscription.unsubscribe();
        setSubscription(null);
        if (userId) {
          await removeSubscriptionFromSupabase(userId);
        }
      }
    } catch (error) {
      console.error('Erro ao cancelar subscrição:', error);
      throw error;
    }
  };

  const saveSubscriptionToSupabase = async (
    pushSubscription: PushSubscription,
    currentUserId: string
  ) => {
    try {
      const subscriptionData = {
        user_id: currentUserId,
        endpoint: pushSubscription.endpoint,
        p256dh: arrayBufferToBase64(pushSubscription.getKey('p256dh')!),
        auth: arrayBufferToBase64(pushSubscription.getKey('auth')!),
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(subscriptionData, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      console.log('Subscription salva no Supabase');
    } catch (error) {
      console.error('Erro ao salvar subscription:', error);
      throw error;
    }
  };

  const removeSubscriptionFromSupabase = async (currentUserId: string) => {
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', currentUserId);

    if (error) {
      console.error('Erro ao remover subscription:', error);
      throw error;
    }
    console.log('Subscription removida do Supabase');
  };

  const sendTestNotification = async () => {
    if (!subscription) {
      throw new Error('Ative as notificações neste dispositivo antes de testar.');
    }
    if (!userId) {
      throw new Error('Faça login para enviar uma notificação de teste.');
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId,
          title: 'Teste de Notificação',
          message: 'Esta é uma notificação de teste do KuidaCar!',
          url: '/'
        }
      });

      if (error) throw error;
      console.log('Notificação de teste enviada:', data);
    } catch (error) {
      console.error('Erro ao enviar notificação de teste:', error);
      throw error;
    }
  };

  return {
    isSupported,
    subscription,
    permission,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
    sendTestNotification
  };
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
