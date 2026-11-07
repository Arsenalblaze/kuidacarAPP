import { useEffect, useMemo, useRef, useState } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { apiClient, supabase } from "../utils/api";
import { playMessageSound } from "../hooks/useRealtimeNotifications";
import { toast } from "sonner";
import {
  MessageSquare,
  User,
  Users,
  Send,
  Loader2,
  Search,
  CheckCheck,
} from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "provider" | "customer" | "admin";
  providerType?: string;
  avatar?: string | null;
  isOnline?: boolean;
}

export const AdminMessagesPage = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"provider" | "customer">("provider");
  const [incomingMessages, setIncomingMessages] = useState<any[]>([]);
  const [respondingMap, setRespondingMap] = useState<Record<string, any>>({});
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [contactsSearch, setContactsSearch] = useState("");
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [replyTarget, setReplyTarget] = useState<any | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const contactsListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadContacts();
    loadIncomingMessages();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getUserContacts();
      if (response.success) {
        setContacts(response.contacts || []);
      } else {
        setContacts([]);
        toast.error("Não foi possível carregar os contatos.");
      }
    } catch (error: any) {
      console.error("Erro ao carregar contatos de mensagens:", error);
      setContacts([]);
      toast.error(error?.message || "Erro ao carregar contatos.");
    } finally {
      setLoading(false);
    }
  };

  const providers = useMemo(
    () => contacts.filter((contact) => contact.role === "provider"),
    [contacts]
  );

  const customers = useMemo(
    () => contacts.filter((contact) => contact.role === "customer"),
    [contacts]
  );

  const visibleContacts = useMemo(() => {
    const base = activeTab === "provider" ? providers : customers;
    const q = String(contactsSearch || "").trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) => String(c.name || "").toLowerCase().includes(q));
  }, [activeTab, providers, customers, contactsSearch]);

  const allVisibleSelected = visibleContacts.length > 0 && visibleContacts.every((contact) => selectedRecipients.has(contact.id));

  const toggleRecipient = (id: string) => {
    setSelectedRecipients((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedRecipients((current) => {
        const next = new Set(current);
        visibleContacts.forEach((contact) => next.delete(contact.id));
        return next;
      });
      return;
    }

    setSelectedRecipients((current) => {
      const next = new Set(current);
      visibleContacts.forEach((contact) => next.add(contact.id));
      return next;
    });
  };

  const getSelectedIds = () => Array.from(selectedRecipients);

  const scrollContactsList = (direction: "up" | "down") => {
    const container = contactsListRef.current;
    if (!container) return;

    const delta = direction === "down" ? 220 : -220;
    container.scrollBy({ top: delta, behavior: "smooth" });
  };

  const sendMessageToRecipients = async (recipientIds: string[], label: string) => {
    if (!message.trim()) {
      toast.error("Digite a mensagem antes de enviar.");
      return;
    }
    if (recipientIds.length === 0) {
      toast.error("Nenhum destinatário selecionado.");
      return;
    }

    setSending(true);
    try {
      const timestamp = Date.now();

      for (const receiverId of recipientIds) {
        await apiClient.sendMessage(
          `admin:${receiverId}:${timestamp}:${Math.random().toString(36).slice(2, 8)}`,
          receiverId,
          message.trim()
        );
      }

      toast.success(`Mensagem enviada para ${label}.`);
      setMessage("");
      setSelectedRecipients(new Set());
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error(error?.message || "Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  };

  const handleSendSelected = () => {
    // clear responding flags for selected recipients after sending
    const ids = getSelectedIds();
    ids.forEach((id) => apiClient.clearRespondingFlag('user', id).catch(() => {}));
    sendMessageToRecipients(ids, "destinatários selecionados");
  };

  const handleSendAllVisible = () => {
    const ids = visibleContacts.map((contact) => contact.id);
    ids.forEach((id) => apiClient.clearRespondingFlag('user', id).catch(() => {}));
    sendMessageToRecipients(ids, activeTab === "provider" ? "todos os mecânicos" : "todos os clientes");
  };

  const handleSendAllContacts = () => {
    const ids = contacts.map((contact) => contact.id);
    ids.forEach((id) => apiClient.clearRespondingFlag('user', id).catch(() => {}));
    sendMessageToRecipients(ids, "todos os usuários");
  };

  const handleSendIndividual = (contact: Contact) => {
    sendMessageToRecipients([contact.id], contact.name);
  };

  const handleOpenReplyModal = async (incomingMessage: any) => {
    if (!incomingMessage?.sender_id) {
      toast.error("Não foi possível identificar o remetente da mensagem.");
      return;
    }

    setReplyTarget(incomingMessage);
    setReplyDraft("");

    try {
      await apiClient.setRespondingFlag('user', incomingMessage.sender_id);
    } catch (error) {
      console.warn("Erro ao marcar resposta ativa para mensagem:", error);
    }
  };

  const closeReplyModal = async () => {
    if (replyTarget?.sender_id) {
      try {
        await apiClient.clearRespondingFlag('user', replyTarget.sender_id);
      } catch (error) {
        console.warn("Erro ao limpar resposta ativa:", error);
      }
    }

    setReplyTarget(null);
    setReplyDraft("");
  };

  const handleSendReplyFromModal = async () => {
    if (!replyTarget?.sender_id) {
      toast.error("Não foi possível identificar o remetente da mensagem.");
      return;
    }

    const trimmed = String(replyDraft || "").trim();
    if (!trimmed) {
      toast.error("Digite a mensagem antes de enviar.");
      return;
    }

    try {
      setSending(true);
      await apiClient.sendMessage(
        `admin:${replyTarget.sender_id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        replyTarget.sender_id,
        trimmed
      );

      if (replyTarget?.id) {
        await apiClient.markMessageAsRead(replyTarget.id);
      }

      toast.success(`Resposta enviada para ${replyTarget.senderName || "o remetente"}.`);
      await closeReplyModal();
    } catch (error: any) {
      console.error("Erro ao responder mensagem do admin:", error);
      toast.error(error?.message || "Erro ao enviar resposta.");
    } finally {
      setSending(false);
    }
  };

  const getMessageStatusData = (message: any) => {
    const respondingKey = `responding:user:${message.sender_id}`;
    if (respondingMap[respondingKey]) {
      return {
        label: "A responder",
        className: "bg-amber-400 text-slate-900 border-amber-300",
      };
    }

    if (message.is_read) {
      return {
        label: "Respondido",
        className: "bg-emerald-500 text-white border-emerald-400",
      };
    }

    return {
      label: "Aberta",
      className: "bg-slate-700 text-slate-100 border-slate-600",
    };
  };

  const loadIncomingMessages = async () => {
    try {
      setInboxLoading(true);
      const { data: authUser, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser.user) {
        throw new Error(authError?.message || "Usuário não autenticado");
      }

      const { data: adminRows, error: adminError } = await supabase
        .from("profiles")
        .select("id")
        .in("role", ["admin", "super_admin"]);

      const adminIds = (adminRows || []).map((row: any) => row.id).filter(Boolean);

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .in("receiver_id", adminIds.length > 0 ? adminIds : [authUser.user.id])
        .neq("sender_id", authUser.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const normalized = await Promise.all(
        (data || []).map(async (message: any) => {
          let senderName = message.sender_id || "Usuário";
          let senderRole: "admin" | "provider" | "customer" =
            message.sender_id?.startsWith("admin") ? "admin" : "customer";

          try {
            const response = await apiClient.getUserById(message.sender_id);
            const resolvedRole = String(response?.user?.role || "").toLowerCase();
            senderName = response?.user?.name || message.sender_id || "Usuário";
            if (resolvedRole === "provider") {
              senderRole = "provider";
            } else if (resolvedRole === "admin" || resolvedRole === "super_admin") {
              senderRole = "admin";
            } else if (resolvedRole === "customer") {
              senderRole = "customer";
            }
          } catch (innerError) {
            senderName = message.sender_id || "Usuário";
          }

          return {
            ...message,
            senderName,
            senderRole,
          };
        })
      );

      const mechanicMessages = normalized.filter((message: any) => {
        const role = String(message.senderRole || "").toLowerCase();
        return role === "provider" || role === "customer";
      });

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role, supervision_admin_id')
        .eq('id', authUser.user.id)
        .maybeSingle();

      const currentRole = String(currentProfile?.role || '').toLowerCase();
      if (currentRole === 'admin' && currentRole !== 'super_admin') {
        const { data: visibleRows } = await supabase
          .from('profiles')
          .select('id, supervision_admin_id')
          .in('role', ['customer', 'provider', 'mechanic']);

        const allowedIds = new Set<string>();
        (visibleRows || []).forEach((row: any) => {
          if (!row.supervision_admin_id || String(row.supervision_admin_id) === authUser.user.id) {
            allowedIds.add(String(row.id));
          }
        });

        const filtered = mechanicMessages.filter((message: any) => {
          const senderId = String(message.sender_id || '');
          return allowedIds.has(senderId) || !senderId;
        });

        setIncomingMessages(filtered);
        return;
      }

      setIncomingMessages(mechanicMessages);
    } catch (error: any) {
      console.error("Erro ao carregar mensagens recebidas do admin:", error);
      toast.error(error?.message || "Erro ao carregar mensagens recebidas.");
      setIncomingMessages([]);
    } finally {
      setInboxLoading(false);
    }
  };

  // Listen for responding flags in KV store so admins see who is replying
  useEffect(() => {
    let sub: any = null;
    (async () => {
      try {
        const { data: authUser } = await supabase.auth.getUser();
        setCurrentAdminId(authUser?.user?.id ?? null);

        sub = supabase
          .channel(`responding_flags_admin`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'kv_store_9dc5328a', filter: `key=like.responding:%` },
            (payload) => {
              const kv = (payload as any).new;
              if (!kv || !kv.key) return;
              setRespondingMap((cur) => ({ ...cur, [kv.key]: kv.value }));
              try {
                const val = kv.value || {};
                if (val.adminId && val.adminId !== currentAdminId) {
                  toast(`${val.adminName || 'Um administrador'} está a responder`);
                }
              } catch (e) {
                // ignore
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'kv_store_9dc5328a', filter: `key=like.responding:%` },
            (payload) => {
              const kv = (payload as any).new;
              if (!kv || !kv.key) return;
              setRespondingMap((cur) => ({ ...cur, [kv.key]: kv.value }));
              try {
                const val = kv.value || {};
                if (val.adminId && val.adminId !== currentAdminId) {
                  toast(`${val.adminName || 'Um administrador'} está a responder`);
                }
              } catch (e) {
                // ignore
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'kv_store_9dc5328a', filter: `key=like.responding:%` },
            (payload) => {
              const kv = (payload as any).old;
              if (!kv || !kv.key) return;
              setRespondingMap((cur) => {
                const next = { ...cur };
                delete next[kv.key];
                return next;
              });
              try {
                const val = kv.value || {};
                if (val.adminId && val.adminId !== currentAdminId) {
                  toast(`${val.adminName || 'Um administrador'} parou de responder`);
                }
              } catch (e) {
                // ignore
              }
            }
          )
          .subscribe();
      } catch (e) {
        console.warn('Erro ao subscrever responding flags:', e);
      }
    })();

    return () => {
      try {
        if (sub) {
          if (typeof sub.unsubscribe === 'function') sub.unsubscribe();
          if (typeof supabase.removeChannel === 'function') supabase.removeChannel(sub);
        }
      } catch (e) {}
    };
  }, []);

  // Realtime subscriptions: listen for new and deleted messages for the admin
  useEffect(() => {
    let channel: any | null = null;

    (async () => {
      try {
        const { data: authUser, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser.user) return;

        const adminId = authUser.user.id;

        const { data: adminRows } = await supabase
          .from("profiles")
          .select("id")
          .in("role", ["admin", "super_admin"]);

        const adminIds = (adminRows || []).map((row: any) => row.id).filter(Boolean);

        channel = supabase
          .channel(`admin_incoming_${adminId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            async (payload) => {
              const newRecord = (payload as any).new;
              if (!newRecord || !newRecord.id) {
                loadIncomingMessages();
                return;
              }

              const isForAdminInbox = adminIds.includes(String(newRecord.receiver_id)) || String(newRecord.receiver_id) === String(adminId);
              if (!isForAdminInbox) return;

              // Normalize sender info similar to loadIncomingMessages
              let senderName = newRecord.sender_id || "Usuário";
              let senderRole: "admin" | "provider" | "customer" =
                newRecord.sender_id?.startsWith("admin") ? "admin" : "customer";
              try {
                const response = await apiClient.getUserById(newRecord.sender_id);
                const resolvedRole = String(response?.user?.role || "").toLowerCase();
                senderName = response?.user?.name || newRecord.sender_id || "Usuário";
                if (resolvedRole === "provider") {
                  senderRole = "provider";
                } else if (resolvedRole === "admin" || resolvedRole === "super_admin") {
                  senderRole = "admin";
                } else if (resolvedRole === "customer") {
                  senderRole = "customer";
                }
              } catch (err) {
                senderName = newRecord.sender_id || "Usuário";
              }

              if (senderRole === "provider" || senderRole === "customer") {
                const normalized = { ...newRecord, senderName, senderRole };
                setIncomingMessages((current) => [normalized, ...current.filter((m) => m.id !== newRecord.id)]);
                playMessageSound();
              }
            }
          )
          .on(
            "postgres_changes",
            { event: "DELETE", schema: "public", table: "messages", filter: `receiver_id=eq.${adminId}` },
            (payload) => {
              const oldRecord = (payload as any).old;
              if (!oldRecord || !oldRecord.id) return;
              setIncomingMessages((current) => current.filter((m) => m.id !== oldRecord.id));
            }
          )
          .subscribe();
      } catch (e) {
        console.warn("Falha na assinatura do inbox do administrador em tempo real:", e);
      }
    })();

    return () => {
      if (channel) {
        try {
          if (typeof channel.unsubscribe === "function") channel.unsubscribe();
          if (typeof supabase.removeChannel === "function") supabase.removeChannel(channel);
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const filteredInbox = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return incomingMessages;

    return incomingMessages.filter((message) => {
      const senderName = (message.senderName || "").toLowerCase();
      const senderId = (message.sender_id || "").toLowerCase();
      const content = (message.content || "").toLowerCase();
      return senderName.includes(query) || senderId.includes(query) || content.includes(query);
    });
  }, [incomingMessages, searchTerm]);

  const markMessageAsRead = async (messageId: string) => {
    try {
      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser.user) {
        throw new Error(authError?.message || "Usuário não autenticado");
      }

      const { error } = await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("id", messageId)
        .eq("receiver_id", authUser.user.id);

      if (error) {
        throw error;
      }

      setIncomingMessages((current) =>
        current.map((message) => (message.id === messageId ? { ...message, is_read: true } : message))
      );
    } catch (error: any) {
      console.error("Erro ao marcar mensagem como lida:", error);
      toast.error(error?.message || "Erro ao marcar mensagem como lida.");
    }
  };

  const markAllMessagesAsRead = async () => {
    try {
      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser.user) {
        throw new Error(authError?.message || "Usuário não autenticado");
      }

      const { error } = await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("receiver_id", authUser.user.id)
        .eq("is_read", false)
        .neq("sender_id", authUser.user.id);

      if (error) {
        throw error;
      }

      setIncomingMessages((current) => current.map((message) => ({ ...message, is_read: true })));
      toast.success("Todas as mensagens foram marcadas como lidas.");
    } catch (error: any) {
      console.error("Erro ao marcar todas as mensagens como lidas:", error);
      toast.error(error?.message || "Erro ao marcar todas como lidas.");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await apiClient.deleteMessage(messageId);
      setIncomingMessages((current) => current.filter((message) => message.id !== messageId));
      setConfirmDeleteMessageId(null);
      toast.success("Mensagem removida com sucesso.");
    } catch (error: any) {
      console.error("Erro ao remover mensagem:", error);
      toast.error(error?.message || "Não foi possível remover a mensagem.");
    }
  };

  const handleDeleteAllMessages = async () => {
    try {
      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser.user) {
        throw new Error(authError?.message || "Usuário não autenticado");
      }

      await apiClient.deleteAllMessagesForUser(authUser.user.id);
      setIncomingMessages([]);
      setShowDeleteAllConfirm(false);
      toast.success("Todas as mensagens foram removidas.");
    } catch (error: any) {
      console.error("Erro ao remover todas as mensagens:", error);
      toast.error(error?.message || "Não foi possível remover todas as mensagens.");
    }
  };

  return (
    <AdminLayout title="Mensagens" subtitle="Gerenciar mensagens do sistema">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-slate-300" />
              <div>
                <p className="text-slate-400 text-sm">Contatos totais</p>
                <p className="text-2xl font-bold text-black">{contacts.length}</p>
              </div>
            </div>
          </Card>
          <Card className="border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-slate-400 text-sm">Mecânicos</p>
                <p className="text-2xl font-bold text-black">{providers.length}</p>
              </div>
            </div>
          </Card>
          <Card className="border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <User className="w-6 h-6 text-blue-400" />
              <div>
                <p className="text-slate-400 text-sm">Clientes</p>
                <p className="text-2xl font-bold text-black">{customers.length}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Mensagens de mecânicos</p>
              <p className="text-slate-400 text-sm">Exibindo apenas mensagens enviadas por mecânicos ao administrador.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={markAllMessagesAsRead} disabled={inboxLoading || incomingMessages.filter((msg) => !msg.is_read).length === 0}>
                <CheckCheck className="w-4 h-4 mr-2" />
                Marcar todas como lidas
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteAllConfirm(true)}
                disabled={inboxLoading || incomingMessages.length === 0}
              >
                Eliminar todas mensagens
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <Label htmlFor="admin-inbox-search" className="sr-only">
              Pesquisar mensagens
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="admin-inbox-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar por remetente, ID ou texto..."
                className="w-full rounded-md border border-slate-700 bg-slate-950 py-2 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-orange-400 focus:outline-none"
              />
            </div>
          </div>

          {inboxLoading ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950/60 p-10">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredInbox.length === 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-6 text-white">
              Nenhuma mensagem recebida para o administrador.
            </div>
          ) : (
            <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {filteredInbox.map((msg) => {
                // highlight if another admin is responding to this sender
                const respondingKey = `responding:user:${msg.sender_id}`;
                const isBeingResponded = Boolean(respondingMap[respondingKey]);

                const statusData = getMessageStatusData(msg);
                const hasDraftText = String(message || "").trim().length > 0;

                return (
                  <div key={msg.id} className={`rounded-xl border p-4 ${isBeingResponded ? 'border-yellow-400/60 bg-yellow-50/10' : msg.is_read ? "border-slate-700 bg-slate-950/60" : "border-orange-500/50 bg-orange-500/5"}`}>
                    <div className="mb-3">
                      <div className={`inline-flex w-fit max-w-full items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${statusData.className}`}>
                        {statusData.label}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="break-words font-semibold text-black">{msg.senderName || msg.sender_id}</p>
                        <p className="break-all text-xs text-slate-600">{msg.sender_id}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(msg.created_at).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 sm:max-w-[50%]">
                        {!msg.is_read && (
                          <span className="rounded-full bg-orange-500/15 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-orange-700">
                            Não lida
                          </span>
                        )}
                        {!msg.is_read && (
                          <Button size="sm" variant="outline" onClick={() => markMessageAsRead(msg.id)} className="whitespace-nowrap">
                            Marcar como lida
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleOpenReplyModal(msg)} disabled={sending} className="whitespace-nowrap">
                          Responder
                        </Button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMessageId(msg.id)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                          aria-label="Eliminar mensagem"
                          title="Eliminar mensagem"
                        >
                          <span className="text-lg leading-none">×</span>
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm text-black">{msg.content}</p>
                    {confirmDeleteMessageId === msg.id && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="mb-3 text-sm font-medium text-red-700">Deseja eliminar esta mensagem?</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteMessage(msg.id)}>
                            Confirmar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setConfirmDeleteMessageId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {showDeleteAllConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 text-white shadow-xl">
              <p className="text-lg font-semibold">Eliminar todas as mensagens?</p>
              <p className="mt-2 text-sm text-slate-300">Esta ação remove todas as mensagens recebidas do painel administrativo.</p>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDeleteAllConfirm(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDeleteAllMessages}>
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        )}

        <Dialog open={Boolean(replyTarget)} onOpenChange={(open) => {
          if (!open) {
            closeReplyModal();
          }
        }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Responder ao mecânico</DialogTitle>
              <DialogDescription>
                {replyTarget ? `Enviar mensagem para ${replyTarget.senderName || replyTarget.sender_id}.` : "Responder ao remetente."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
                <span className="font-medium text-white">Remetente:</span> {replyTarget?.senderName || replyTarget?.sender_id || "Desconhecido"}
              </div>

              <Textarea
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                placeholder="Escreva a resposta para o mecânico..."
                className="min-h-[140px] bg-slate-950 text-white"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={closeReplyModal} disabled={sending}>
                Cancelar
              </Button>
              <Button onClick={handleSendReplyFromModal} disabled={sending || !String(replyDraft || "").trim()}>
                {sending ? "Enviando..." : "Enviar resposta"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="p-6">
          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] items-stretch">
            <div className="space-y-4 flex flex-col h-full">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Destino</p>
                  <p className="text-slate-400 text-sm">Selecione mecânicos ou clientes para enviar a mensagem.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={activeTab === "provider" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("provider")}
                  >
                    Mecânicos
                  </Button>
                  <Button
                    variant={activeTab === "customer" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("customer")}
                  >
                    Clientes
                  </Button>
                  <div className="relative w-full sm:w-48 sm:ml-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={contactsSearch}
                      onChange={(e) => setContactsSearch(e.target.value)}
                      placeholder={activeTab === 'provider' ? 'Pesquisar mecânicos por nome' : 'Pesquisar clientes por nome'}
                      className="w-full pl-10 bg-slate-900/80 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{activeTab === "provider" ? "Mecânicos" : "Clientes"}</p>
                    <p className="text-slate-400 text-sm">
                      {visibleContacts.length} {activeTab === "provider" ? "mecânicos" : "clientes"} disponíveis.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={toggleSelectAllVisible}>
                    {allVisibleSelected ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950/60 p-10">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                  </div>
                ) : visibleContacts.length === 0 ? (
                  <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-6 text-slate-400">
                    Não há {activeTab === "provider" ? "mecânicos" : "clientes"} cadastrados.
                  </div>
                ) : (
                  <>
                    {visibleContacts.length > 8 && (
                      <div className="flex items-center justify-end gap-2 pb-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => scrollContactsList("up")}>
                          ↑
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => scrollContactsList("down")}>
                          ↓
                        </Button>
                      </div>
                    )}
                    <div ref={contactsListRef} className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
                      {visibleContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedRecipients.has(contact.id)}
                              onChange={() => toggleRecipient(contact.id)}
                              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500"
                            />
                            <div>
                              <p className="font-semibold text-white">{contact.name}</p>
                              <p className="text-xs text-slate-500">{contact.email || contact.phone || "Sem contato"}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400">
                              {contact.role === "provider" ? "Mecânico" : "Cliente"}
                            </span>
                            {contact.isOnline ? (
                              <span className="rounded-full bg-emerald-600/20 px-2 py-1 text-xs text-emerald-300">Conectado</span>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSendIndividual(contact)}
                              disabled={sending}
                            >
                              <Send className="w-4 h-4 mr-2" />
                              Enviar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-white">Mensagem</p>
                <p className="text-slate-400 text-sm">Escreva a mensagem que será enviada aos destinatários selecionados.</p>
              </div>
              <div className="flex-1 flex flex-col">
                <Label htmlFor="admin-message" className="sr-only">
                  Mensagem
                </Label>
                <Textarea
                  id="admin-message"
                  value={message}
                  onChange={(event) => {
                    const val = event.target.value;
                    setMessage(val);
                    const trimmed = val.trim();
                    // set responding flags for each selected recipient when typing
                    if (trimmed.length > 0) {
                      Array.from(selectedRecipients).forEach((id) => apiClient.setRespondingFlag('user', id).catch(() => {}));
                    } else {
                      Array.from(selectedRecipients).forEach((id) => apiClient.clearRespondingFlag('user', id).catch(() => {}));
                    }
                  }}
                  placeholder="Escreva a mensagem aqui..."
                  className="flex-1 min-h-[140px] w-full resize-none bg-slate-950 border-slate-700 text-slate-100 focus:border-orange-400 focus:ring-orange-400"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button onClick={handleSendSelected} disabled={sending || selectedRecipients.size === 0}>
                  {sending ? "Enviando..." : "Enviar para selecionados"}
                </Button>
                <Button variant="outline" onClick={handleSendAllVisible} disabled={sending || visibleContacts.length === 0}>
                  {sending ? "Enviando..." : `Enviar para todos os ${activeTab === "provider" ? "mecânicos" : "clientes"}`}
                </Button>
              </div>
              <Button variant="secondary" onClick={handleSendAllContacts} disabled={sending || contacts.length === 0}>
                {sending ? "Enviando..." : "Enviar para todos os usuários"}
              </Button>
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-400">
                <p>Selecionados: {selectedRecipients.size}</p>
                <p className="mt-1">Use os botões individuais para enviar mensagem rapidamente a um usuário específico.</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};
