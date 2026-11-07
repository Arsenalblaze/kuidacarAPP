import { useMemo, useState } from "react";
import { Bell, CheckCircle2, X } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "./ui/dialog";
import { NotificationItem } from "../hooks/useRealtimeNotifications";

interface NotificationBellProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNotificationClick?: (notification: NotificationItem) => void;
  onDeleteNotification?: (id: string) => void;
  onDeleteAllNotifications?: () => void;
}

export function NotificationBell({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
  onDeleteNotification,
  onDeleteAllNotifications,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const latestNotifications = useMemo(
    () => notifications.slice(0, 6),
    [notifications]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="relative">
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="text-white hover:bg-orange-700">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 rounded-full bg-red-500 text-white px-2 py-0.5 text-[10px]">{unreadCount}</Badge>
            )}
          </Button>
        </DialogTrigger>
      </div>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle>Notificações</DialogTitle>
              <DialogDescription>
                {unreadCount} não lida(s)
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onMarkAllAsRead}>
                Marcar todas como lidas
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteAllConfirm(true)} disabled={notifications.length === 0}>
                Eliminar todas
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-4 max-h-96 overflow-y-auto pr-2">
          {latestNotifications.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
              Nenhuma notificação recente
            </div>
          ) : (
            latestNotifications.map((notification) => (
              <div
                key={notification.id}
                className="w-full rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-orange-300 hover:bg-orange-50"
              >
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onMarkAsRead(notification.id);
                      onNotificationClick?.(notification);
                    }}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <CheckCircle2 className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm text-gray-900">{notification.title}</p>
                          {notification.status === "unread" && (
                            <Badge className="bg-red-500 text-white">Novo</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                        {notification.request_id && (
                          <p className="text-xs text-gray-500 mt-2">Pedido: {notification.request_id}</p>
                        )}
                      </div>
                    </div>
                  </button>
                  {onDeleteNotification && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(notification.id);
                      }}
                      className="flex-shrink-0 text-gray-400 hover:text-red-600 transition"
                      title="Eliminar notificação"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {confirmDeleteId === notification.id && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="mb-3 text-sm font-medium text-red-700">Deseja eliminar esta notificação?</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => { onDeleteNotification?.(notification.id); setConfirmDeleteId(null); }}>
                        Confirmar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {showDeleteAllConfirm && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="mb-3 text-sm font-medium text-red-700">Deseja eliminar todas as notificações?</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={() => { onDeleteAllNotifications?.(); setShowDeleteAllConfirm(false); }}>
                Confirmar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowDeleteAllConfirm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <DialogClose asChild>
            <Button variant="outline">Ok</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
