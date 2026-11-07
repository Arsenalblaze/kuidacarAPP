import React, { useEffect, useMemo, useState } from "react";
import { Bell, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../utils/api";
import { AdminSidebar } from "../components/AdminSidebar";
import { playMessageSound, playNotificationSound } from "../hooks/useRealtimeNotifications";

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  title,
  subtitle,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setChatUnreadCount(0);
      setNotificationCount(0);
      return;
    }

    const notificationChannel = supabase
      .channel(`admin_header_notifications_${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kv_store_9dc5328a", filter: `key=like.notification:%` },
        (payload) => {
          const value = (payload as any)?.new?.value;
          const notification = typeof value === "string" ? JSON.parse(value) : value;
          if (!notification || !notification?.id) return;

          const isForCurrentAdmin =
            notification.user_id === user.id ||
            notification.user_id === "admin" ||
            notification.user_id === "super_admin" ||
            notification.payload?.targetAdminId === user.id ||
            notification.payload?.targetRole === user.role;

          if (isForCurrentAdmin) {
            playNotificationSound();
          }
        }
      )
      .subscribe();

    const chatChannel = supabase
      .channel(`admin_header_chat_${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kv_store_9dc5328a", filter: `key=like.admin_chat:%` },
        (payload) => {
          const value = (payload as any)?.new?.value;
          const message = typeof value === "string" ? JSON.parse(value) : value;
          if (!message || !message?.id) return;

          const targetMatchesCurrent =
            message.targetId === user.id ||
            (message.targetId === "admin" && user.role === "admin") ||
            (message.targetId === "super_admin" && user.role === "super_admin") ||
            (message.targetId === "admin" && user.role === "super_admin") ||
            (message.targetId === "super_admin" && user.role === "admin");

          if (targetMatchesCurrent && message.senderId !== user.id) {
            playMessageSound();
          }
        }
      )
      .subscribe();

    const loadHeaderAlerts = async () => {
      try {
        const [chatResult, notificationResult] = await Promise.all([
          supabase.from("kv_store_9dc5328a").select("value").like("key", "admin_chat:%"),
          supabase.from("kv_store_9dc5328a").select("value").like("key", "notification:%"),
        ]);

        if (chatResult.error) throw chatResult.error;
        if (notificationResult.error) throw notificationResult.error;

        const unreadChatCount = (chatResult.data || []).reduce((count, row: any) => {
          let value = row.value;
          if (typeof value === "string") {
            try {
              value = JSON.parse(value);
            } catch {
              value = {};
            }
          }

          if (!value || !value.targetId || value.senderId === user.id) return count;

          const targetMatchesCurrent =
            value.targetId === user.id ||
            (value.targetId === "admin" && user.role === "admin") ||
            (value.targetId === "super_admin" && user.role === "super_admin") ||
            (value.targetId === "admin" && user.role === "super_admin") ||
            (value.targetId === "super_admin" && user.role === "admin");

          return count + (targetMatchesCurrent ? 1 : 0);
        }, 0);

        const unreadNotificationCount = (notificationResult.data || []).reduce((count, row: any) => {
          let value = row.value;
          if (typeof value === "string") {
            try {
              value = JSON.parse(value);
            } catch {
              value = {};
            }
          }

          if (!value || value.status !== "unread") return count;

          const isForCurrentAdmin =
            value.user_id === user.id ||
            value.user_id === "admin" ||
            value.user_id === "super_admin" ||
            value.payload?.targetAdminId === user.id ||
            value.payload?.targetRole === user.role;

          return count + (isForCurrentAdmin ? 1 : 0);
        }, 0);

        setChatUnreadCount(unreadChatCount);
        setNotificationCount(unreadNotificationCount);
      } catch (error) {
        console.warn("Não foi possível carregar alertas do header admin:", error);
        setChatUnreadCount(0);
        setNotificationCount(0);
      }
    };

    loadHeaderAlerts();

    return () => {
      notificationChannel.unsubscribe();
      chatChannel.unsubscribe();
    };
  }, [user?.id, user?.role]);

  const notificationBadge = useMemo(() =>
    notificationCount > 99 ? "99+" : String(notificationCount),
    [notificationCount]
  );

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden md:ml-0">
        {/* Header */}
        {(title || subtitle) && (
          <div className="bg-slate-900 border-b border-slate-700 px-6 py-4 md:mt-0 mt-12">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">{title}</h1>
                {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/admin/chat")}
                  className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${chatUnreadCount > 0 ? "border-red-500/80 bg-red-500/10 text-red-300 animate-pulse" : "border-slate-700 bg-slate-800 text-slate-200 hover:border-orange-500 hover:text-orange-300"}`}
                  aria-label="Abrir chat do administrador"
                  title="Chat do administrador"
                >
                  <MessageSquare className="h-5 w-5" />
                  {chatUnreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-lg shadow-red-500/30">
                      {chatUnreadCount > 9 ? "9+" : chatUnreadCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/admin/notifications")}
                  className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${notificationCount > 0 ? "border-red-500/80 bg-red-500/10 text-red-300 animate-pulse" : "border-slate-700 bg-slate-800 text-slate-200 hover:border-orange-500 hover:text-orange-300"}`}
                  aria-label="Abrir notificações"
                  title="Notificações"
                >
                  <Bell className="h-5 w-5" />
                  {notificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-lg shadow-red-500/30">
                      {notificationBadge}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Area with Scrolling */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">{children}</div>
        </div>
      </main>
    </div>
  );
};
