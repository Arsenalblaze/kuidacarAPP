import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { apiClient } from "../utils/api";
import { toast } from "sonner";
import {
  Bell,
  ShieldAlert,
  Loader2,
  Sparkles,
  CheckCheck,
} from "lucide-react";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "super_admin";
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  status: "unread" | "read";
  created_at: string;
  user_id?: string;
  payload?: Record<string, any>;
}

export const AdminNotificationsPage = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const response = await apiClient.getAdminNotifications();
      const list = (response.notifications || []).filter((item: any) => item && item.title);
      setNotifications(list as NotificationItem[]);
    } catch (error: any) {
      console.error("Erro ao carregar notificações:", error);
      toast.error(error?.message || "Erro ao carregar notificações.");
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await apiClient.markAllNotificationsAsReadForUser("admin");
      setNotifications((current) => current.map((item) => ({ ...item, status: "read" })));
      toast.success("Todas as notificações do administrador foram marcadas como lidas.");
    } catch (error: any) {
      console.error("Erro ao marcar notificações como lidas:", error);
      toast.error(error?.message || "Erro ao atualizar notificações.");
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await apiClient.deleteNotification(notificationId);
      setNotifications((current) => current.filter((item) => item.id !== notificationId));
      setConfirmDeleteId(null);
      toast.success("Notificação eliminada.");
    } catch (error: any) {
      console.error("Erro ao apagar notificação:", error);
      toast.error(error?.message || "Não foi possível apagar a notificação.");
    }
  };

  const handleDeleteAllNotifications = async () => {
    try {
      await apiClient.deleteAllNotificationsForUser("admin");
      setNotifications([]);
      setShowDeleteAllConfirm(false);
      toast.success("Todas as notificações foram eliminadas.");
    } catch (error: any) {
      console.error("Erro ao apagar todas as notificações:", error);
      toast.error(error?.message || "Não foi possível apagar todas as notificações.");
    }
  };

  return (
    <AdminLayout title="Notificações" subtitle="Alertas do sistema e comunicação interna entre administradores">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-700 bg-white p-4">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-orange-400" />
              <div>
                <p className="text-sm text-black">Total</p>
                <p className="text-2xl font-bold text-black">{notifications.length}</p>
              </div>
            </div>
          </Card>
          <Card className="border-slate-700 bg-white p-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-red-400" />
              <div>
                <p className="text-sm text-black">Alertas</p>
                <p className="text-2xl font-bold text-black">{notifications.filter((n) => n.type.includes("alert") || n.type.includes("suspicious")).length}</p>
              </div>
            </div>
          </Card>
          <Card className="border-slate-700 bg-white p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-emerald-400" />
              <div>
                <p className="text-sm text-black">Ativas</p>
                <p className="text-2xl font-bold text-black">{notifications.filter((n) => n.status === "unread").length}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="border-slate-700 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Central de notificações</p>
              <p className="text-slate-400 text-sm">Alertas do sistema, ações duvidosas e avisos para a equipe administrativa.</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Pesquisar por título, mensagem, usuário ou payload..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md"
              />
              <Button variant="outline" size="sm" onClick={loadNotifications}>
                Atualizar
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteAllConfirm(true)} disabled={notifications.length === 0}>
                Eliminar todas
              </Button>
            </div>
          </div>

          {loadingNotifications ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950/60 p-10 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Carregando notificações...
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-6 text-slate-400">
              Nenhuma notificação administrava no momento.
            </div>
          ) : (
            <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">
              {(() => {
                const q = (search || "").trim().toLowerCase();
                const filtered = q
                  ? notifications.filter((n) => {
                      if (!n) return false;
                      const hay = `${n.title || ""} ${n.message || ""} ${JSON.stringify(n.payload || {})} ${n.user_id || ""}`.toLowerCase();
                      return hay.includes(q);
                    })
                  : notifications;

                return filtered.map((notification) => (
                <div key={notification.id} className={`rounded-xl border p-4 ${notification.status === "unread" ? "border-orange-500/50 bg-orange-500/5" : "border-slate-700 bg-slate-950/60"}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${notification.type.includes("alert") || notification.type.includes("suspicious") ? "bg-red-500/15 text-red-700" : "bg-blue-500/15 text-blue-700"}`}>
                          {notification.type}
                        </span>
                        <span className="text-xs text-slate-600">{new Date(notification.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      <p className="mt-2 text-lg font-semibold text-black">{notification.title}</p>
                      <p className="mt-1 text-sm text-black/80">{notification.message}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {notification.status === "unread" && (
                        <span className="rounded-full bg-orange-500/15 px-2 py-1 text-[10px] font-semibold uppercase text-orange-200">Nova</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(notification.id)}
                        className="rounded-full border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                        aria-label="Eliminar notificação"
                        title="Eliminar notificação"
                      >
                        <span className="text-lg leading-none">×</span>
                      </button>
                    </div>
                  </div>

                  {confirmDeleteId === notification.id && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="mb-3 text-sm font-medium text-red-700">Deseja eliminar esta notificação?</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteNotification(notification.id)}>
                          Confirmar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                ));
              })()}
            </div>
          )}
        </Card>

        {showDeleteAllConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 text-white shadow-xl">
              <p className="text-lg font-semibold">Eliminar todas as notificações?</p>
              <p className="mt-2 text-sm text-slate-300">Esta ação remove todas as notificações da central administrativa.</p>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDeleteAllConfirm(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDeleteAllNotifications}>
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
