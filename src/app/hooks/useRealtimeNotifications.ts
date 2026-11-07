import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient, supabase } from "../utils/api";

export interface NotificationItem {
  id: string;
  user_id: string;
  request_id?: string;
  type: string;
  title: string;
  message: string;
  payload?: Record<string, any> | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface UseRealtimeNotificationsOptions {
  autoRemindMs?: number;
  onNewNotification?: (notification: NotificationItem) => void;
}

const SOUND_COOLDOWN_MS = 3000;
const lastSoundTimestamps: Record<"notification" | "message", number> = {
  notification: 0,
  message: 0,
};

let soundAudioContext: AudioContext | null = null;

const getAudioContext = () => {
  const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextConstructor) return null;

  if (!soundAudioContext || soundAudioContext.state === "closed") {
    soundAudioContext = new AudioContextConstructor();
  }

  return soundAudioContext;
};

const unlockAudio = () => {
  try {
    const audioContext = getAudioContext();
    if (audioContext?.state === "suspended") {
      audioContext.resume().catch((error) => {
        console.warn("Aviso: não foi possível ativar o áudio de notificações.", error);
      });
    }
  } catch (error) {
    console.warn("Aviso: não foi possível preparar o áudio de notificações.", error);
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlockAudio);
  window.addEventListener("keydown", unlockAudio);
  window.addEventListener("touchend", unlockAudio);
}

const playTone = (kind: "notification" | "message") => {
  const now = Date.now();
  if (now - lastSoundTimestamps[kind] < SOUND_COOLDOWN_MS) {
    return;
  }

  try {
    const audioContext = getAudioContext();
    if (!audioContext) return;

    const play = () => {
      const startAt = audioContext.currentTime;
      const duration = kind === "notification" ? 0.22 : 0.18;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(kind === "notification" ? 880 : 1320, startAt);
      if (kind === "message") {
        oscillator.frequency.exponentialRampToValueAtTime(1620, startAt + 0.08);
      }

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      lastSoundTimestamps[kind] = Date.now();
    };

    if (audioContext.state === "running") {
      play();
    } else {
      audioContext.resume().then(() => {
        if (audioContext.state === "running") play();
      }).catch((error) => {
        console.warn(kind === "notification" ? "Aviso: não foi possível reproduzir som de notificação." : "Aviso: não foi possível reproduzir som de mensagem.", error);
      });
    }
  } catch (error) {
    console.warn(kind === "notification" ? "Aviso: não foi possível reproduzir som de notificação." : "Aviso: não foi possível reproduzir som de mensagem.", error);
  }
};

export const playNotificationSound = () => playTone("notification");
export const playMessageSound = () => playTone("message");

export function useRealtimeNotifications(
  userId: string | null,
  options: UseRealtimeNotificationsOptions = {}
) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const reminderRef = useRef<number | null>(null);
  const seenNotificationIdsRef = useRef(new Set<string>());

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.status === "unread").length,
    [notifications]
  );

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      const response = await apiClient.getUserNotifications(userId);
      if (response.success && Array.isArray(response.notifications)) {
        response.notifications.forEach((notification: NotificationItem) => {
          seenNotificationIdsRef.current.add(notification.id);
        });
        setNotifications(response.notifications);
      }
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return;
      try {
        await apiClient.markNotificationAsRead(notificationId);
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId
              ? { ...notification, status: "read", updated_at: new Date().toISOString() }
              : notification
          )
        );
      } catch (error) {
        console.error("Erro ao marcar notificação como lida:", error);
      }
    },
    [userId]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    try {
      await apiClient.markAllNotificationsAsReadForUser(userId);
      setNotifications((prev) => prev.map((notification) => ({ ...notification, status: "read" })));
    } catch (error) {
      console.error("Erro ao marcar todas as notificações como lidas:", error);
    }
  }, [userId]);

  const handleIncomingNotification = useCallback((notification: NotificationItem) => {
    if (!notification?.id || notification.user_id !== userId) return;
    if (seenNotificationIdsRef.current.has(notification.id)) return;

    seenNotificationIdsRef.current.add(notification.id);
    setNotifications((prev) => [notification, ...prev]);
    options.onNewNotification?.(notification);
    playNotificationSound();
  }, [options.onNewNotification, userId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId) return;

    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    const subscription = supabase
      .channel(`notifications_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kv_store_9dc5328a", filter: `key=like.notification:%` },
        (payload) => {
          const kvRow = (payload as any).new;
          const notification = kvRow?.value as NotificationItem;
          handleIncomingNotification(notification);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const notification = (payload as any).new as NotificationItem;
          handleIncomingNotification(notification);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "kv_store_9dc5328a", filter: `key=like.notification:%` },
        (payload) => {
          const kvRow = (payload as any).new;
          const notification = kvRow?.value as NotificationItem;

          if (!notification?.id || notification.user_id !== userId) return;

          setNotifications((prev) =>
            prev.map((item) => (item.id === notification.id ? notification : item))
          );
        }
      )
      .subscribe();

    subscriptionRef.current = subscription;

    return () => {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [userId, handleIncomingNotification]);

  useEffect(() => {
    if (!userId || !options.autoRemindMs || unreadCount === 0) return;

    if (reminderRef.current) {
      window.clearInterval(reminderRef.current);
      reminderRef.current = null;
    }

    reminderRef.current = window.setInterval(() => {
      playNotificationSound();
    }, options.autoRemindMs);

    return () => {
      if (reminderRef.current) {
        window.clearInterval(reminderRef.current);
        reminderRef.current = null;
      }
    };
  }, [userId, options.autoRemindMs, unreadCount]);

  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (reminderRef.current) {
        window.clearInterval(reminderRef.current);
        reminderRef.current = null;
      }
    };
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    setNotifications,
  };
}
