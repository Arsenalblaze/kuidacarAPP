import { useEffect, useMemo, useRef, useState } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { apiClient, supabase } from "../utils/api";
import { toast } from "sonner";
import {
  Search,
  Send,
  Loader2,
  UserCircle2,
  Shield,
  ArrowDown,
} from "lucide-react";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "super_admin";
  isOnline: boolean;
}

interface InternalChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: "admin" | "super_admin";
  targetId: string;
  targetName: string;
  targetRole: "admin" | "super_admin";
  text: string;
  createdAt: string;
}

export const AdminInternalChatPage = ({ embedded = false }: { embedded?: boolean }) => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [chatHistory, setChatHistory] = useState<InternalChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadAdmins();
    loadCurrentAdmin();
  }, []);

  useEffect(() => {
    if (!selectedAdminId) return;
    loadChatHistory(selectedAdminId);
  }, [selectedAdminId]);

  const normalizeChatEntry = (row: any): InternalChatMessage | null => {
    if (!row) return null;

    let value = row.value ?? row;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        value = {};
      }
    }

    if (!value || !value.senderId || !value.targetId) return null;

    const senderRole = value.senderRole === "super_admin" ? "super_admin" : "admin";
    const targetRole = value.targetRole === "super_admin" ? "super_admin" : "admin";

    return {
      id: String(value.id || row.key || `${value.senderId}:${value.targetId}:${value.createdAt}`),
      senderId: value.senderId,
      senderName: value.senderName || "Administrador",
      senderRole,
      targetId: value.targetId,
      targetName: value.targetName || "Administrador",
      targetRole,
      text: value.text || "",
      createdAt: value.createdAt || new Date().toISOString(),
    };
  };

  const loadCurrentAdmin = async () => {
    try {
      const response = await apiClient.getStoredUser();
      const stored = response.success ? response.user : null;
      if (stored) {
        const { data: presenceRow, error } = await supabase
          .from("kv_store_9dc5328a")
          .select("value")
          .eq("key", `user:${stored.id}`)
          .maybeSingle();
        if (error) throw error;
        let profile = presenceRow?.value;
        if (typeof profile === "string") {
          try {
            profile = JSON.parse(profile);
          } catch {
            profile = null;
          }
        }
        setCurrentAdmin({
          id: stored.id,
          name: stored.name,
          email: stored.email,
          role: stored.role === "super_admin" ? "super_admin" : "admin",
          isOnline: (profile as { adminPresenceStatus?: string } | null)?.adminPresenceStatus === "online",
        });
      }
    } catch (error) {
      console.warn("Erro ao carregar admin atual:", error);
    }
  };

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("kv_store_9dc5328a")
        .select("key,value")
        .like("key", "user:%");

      if (error) throw error;

      const list = (data || [])
        .map((row: any) => {
          let profile = row.value;
          if (typeof profile === "string") {
            try { profile = JSON.parse(profile); } catch { profile = {}; }
          }

          const role = String(profile?.role || "").toLowerCase();
          if (role !== "admin" && role !== "super_admin") return null;

          return {
            id: profile?.id || row.key.replace(/^user:/, ""),
            name: profile?.name || profile?.email || "Administrador",
            email: profile?.email || "",
            role: role === "super_admin" ? "super_admin" : "admin",
            isOnline: profile?.adminPresenceStatus === "online",
          } as AdminUser;
        })
        .filter(Boolean) as AdminUser[];

      const deduped = list.filter((item, index, array) =>
        array.findIndex((entry) => entry.id === item.id) === index
      );

      setAdmins(deduped);
      if (deduped.length > 0 && !selectedAdminId) {
        setSelectedAdminId(deduped[0].id);
      }
    } catch (error: any) {
      console.error("Erro ao carregar admins do chat:", error);
      toast.error(error?.message || "Erro ao carregar administradores.");
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel("admin_internal_chat_presence")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kv_store_9dc5328a" },
        (payload) => {
          const row = payload.new as { key?: string; value?: unknown } | null;
          const key = String(row?.key || "");
          if (!key.startsWith("user:")) return;

          const adminId = key.replace(/^user:/, "");
          let profile: Record<string, unknown> =
            row?.value && typeof row.value === "object"
              ? row.value as Record<string, unknown>
              : {};
          if (typeof row?.value === "string") {
            try {
              profile = JSON.parse(row.value) as Record<string, unknown>;
            } catch {
              return;
            }
          }
          const role = String(profile.role || "").toLowerCase();
          if (role !== "admin" && role !== "super_admin") return;

          setAdmins((current) => current.map((admin) =>
            admin.id === adminId
              ? {
                  ...admin,
                  name: String(profile.name || profile.email || admin.name),
                  email: String(profile.email || admin.email),
                  isOnline: profile.adminPresenceStatus === "online",
                }
              : admin,
          ));
          setCurrentAdmin((current) =>
            current?.id === adminId
              ? { ...current, isOnline: profile.adminPresenceStatus === "online" }
              : current,
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const loadChatHistory = async (targetId: string) => {
    try {
      const { data, error } = await supabase
        .from("kv_store_9dc5328a")
        .select("key,value")
        .like("key", "admin_chat:%");

      if (error) throw error;

      const entries: InternalChatMessage[] = (data || [])
        .map((row: any) => {
          const entry = normalizeChatEntry(row);
          if (!entry) return null;

          const isRelevant =
            (entry.senderId === (currentAdmin?.id || "") && entry.targetId === targetId) ||
            (entry.targetId === (currentAdmin?.id || "") && entry.senderId === targetId) ||
            (entry.senderId === targetId && entry.targetId === (currentAdmin?.id || "")) ||
            (entry.targetId === targetId && entry.senderId === (currentAdmin?.id || ""));

          if (!isRelevant) return null;

          return entry;
        })
        .filter(Boolean) as InternalChatMessage[];

      setChatHistory(entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch (error: any) {
      console.error("Erro ao carregar histórico do chat:", error);
      setChatHistory([]);
    }
  };

  useEffect(() => {
    if (!currentAdmin?.id) return;

    const channel = supabase
      .channel(`admin_internal_chat_realtime_${currentAdmin.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kv_store_9dc5328a", filter: "key=like.admin_chat:%" },
        (payload) => {
          const entry = normalizeChatEntry((payload as any).new);
          if (!entry) return;

          const isRelevant =
            (entry.senderId === currentAdmin.id && entry.targetId === selectedAdminId) ||
            (entry.targetId === currentAdmin.id && entry.senderId === selectedAdminId) ||
            (entry.senderId === selectedAdminId && entry.targetId === currentAdmin.id) ||
            (entry.targetId === selectedAdminId && entry.senderId === currentAdmin.id);

          if (!isRelevant) return;

          setChatHistory((prev) => {
            if (prev.some((message) => message.id === entry.id)) return prev;
            return [...prev, entry].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "kv_store_9dc5328a", filter: "key=like.admin_chat:%" },
        (payload) => {
          const entry = normalizeChatEntry((payload as any).new);
          if (!entry) return;

          const isRelevant =
            (entry.senderId === currentAdmin.id && entry.targetId === selectedAdminId) ||
            (entry.targetId === currentAdmin.id && entry.senderId === selectedAdminId) ||
            (entry.senderId === selectedAdminId && entry.targetId === currentAdmin.id) ||
            (entry.targetId === selectedAdminId && entry.senderId === currentAdmin.id);

          if (!isRelevant) return;

          setChatHistory((prev) => {
            const existingIndex = prev.findIndex((message) => message.id === entry.id);
            if (existingIndex === -1) {
              return [...prev, entry].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            }

            const next = [...prev];
            next[existingIndex] = entry;
            return next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "kv_store_9dc5328a", filter: "key=like.admin_chat:%" },
        (payload) => {
          const oldEntry = normalizeChatEntry((payload as any).old);
          if (!oldEntry) return;

          const isRelevant =
            (oldEntry.senderId === currentAdmin.id && oldEntry.targetId === selectedAdminId) ||
            (oldEntry.targetId === currentAdmin.id && oldEntry.senderId === selectedAdminId) ||
            (oldEntry.senderId === selectedAdminId && oldEntry.targetId === currentAdmin.id) ||
            (oldEntry.targetId === selectedAdminId && oldEntry.senderId === currentAdmin.id);

          if (!isRelevant) return;

          setChatHistory((prev) => prev.filter((message) => message.id !== oldEntry.id));
        }
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
      } catch (error) {
        console.warn("Erro ao remover canal do chat interno realtime:", error);
      }
    };
  }, [currentAdmin, selectedAdminId]);

  const filteredAdmins = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter((admin) =>
      admin.name.toLowerCase().includes(q) ||
      admin.email.toLowerCase().includes(q) ||
      admin.role.toLowerCase().includes(q)
    );
  }, [admins, search]);

  const sendMessage = async () => {
    if (!selectedAdminId) {
      toast.error("Selecione um destinatário antes de enviar.");
      return;
    }

    if (!message.trim()) {
      toast.error("Digite a mensagem antes de enviar.");
      return;
    }

    if (!currentAdmin) {
      toast.error("Não foi possível identificar o administrador atual.");
      return;
    }

    try {
      setSending(true);

      const target = admins.find((admin) => admin.id === selectedAdminId);
      if (!target) {
        throw new Error("Destinatário não encontrado.");
      }

      const messageEntry = {
        id: `admin_chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        senderId: currentAdmin.id,
        senderName: currentAdmin.name,
        senderRole: currentAdmin.role,
        targetId: target.id,
        targetName: target.name,
        targetRole: target.role,
        text: message.trim(),
        createdAt: new Date().toISOString(),
      };

      const key = `admin_chat:${messageEntry.id}`;
      await supabase.from("kv_store_9dc5328a").upsert({ key, value: messageEntry });

      setChatHistory((prev) => [...prev, messageEntry]);
      setMessage("");
      toast.success("Mensagem enviada para o administrador selecionado.");
    } catch (error: any) {
      console.error("Erro ao enviar mensagem do chat interno:", error);
      toast.error(error?.message || "Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  };

  const selectedAdmin = admins.find((admin) => admin.id === selectedAdminId) || null;

  const handleDeleteChatMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('kv_store_9dc5328a')
        .delete()
        .eq('key', `admin_chat:${messageId}`);

      if (error) {
        throw new Error(error.message);
      }

      setChatHistory((prev) => prev.filter((message) => message.id !== messageId));
      setConfirmDeleteMessageId(null);
      toast.success('Mensagem eliminada do chat administrativo.');
    } catch (error: any) {
      console.error('Erro ao eliminar mensagem do chat administrativo:', error);
      toast.error(error?.message || 'Não foi possível eliminar a mensagem do chat.');
    }
  };

  const scrollToBottom = () => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (!chatScrollRef.current) return;
    const element = chatScrollRef.current;
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
    setShowScrollButton(!isNearBottom && chatHistory.length > 0);
  }, [chatHistory, selectedAdminId]);

  useEffect(() => {
    if (chatHistory.length > 0) {
      scrollToBottom();
    }
  }, [chatHistory]);

  const content = (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <Card className="border-slate-700 p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-white">Administradores</p>
            <p className="text-slate-400 text-sm">Selecione para enviar uma mensagem interna.</p>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou cargo"
              className="pl-10 text-white placeholder:text-slate-400"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950/60 p-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Carregando...
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-slate-400">
              Nenhum administrador disponível.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAdmins.map((admin) => (
                <button
                  key={admin.id}
                  type="button"
                  onClick={() => setSelectedAdminId(admin.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${selectedAdminId === admin.id ? "border-orange-500 bg-orange-500/10" : "border-slate-700 bg-slate-950/50 hover:border-slate-500"}`}
                >
                  <div className="flex items-center gap-3">
                    <UserCircle2 className="h-8 w-8 text-slate-300" />
                    <div>
                      <p className="font-medium text-slate-100">{admin.name}</p>
                      <p className="text-xs text-slate-400">{admin.email}</p>
                      <p className={`mt-1 flex items-center gap-1.5 text-xs ${admin.isOnline ? "text-green-400" : "text-slate-400"}`}>
                        <span className={`h-2 w-2 rounded-full ${admin.isOnline ? "bg-green-400" : "bg-slate-500"}`} />
                        {admin.isOnline ? "Conectado" : "Desconectado"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${admin.role === "super_admin" ? "bg-purple-500/20 text-purple-200" : "bg-blue-500/20 text-blue-200"}`}>
                      {admin.role === "super_admin" ? "Superadministrador" : "Administrador"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="border-slate-700 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Conversa interna</p>
              <p className="text-slate-400 text-sm">
                {selectedAdmin ? `Conversa com ${selectedAdmin.name} (${selectedAdmin.role === "super_admin" ? "Superadministrador" : "Administrador"})` : "Selecione um destinatário"}
              </p>
              {selectedAdmin && (
                <p className={`mt-1 flex items-center gap-1.5 text-xs ${selectedAdmin.isOnline ? "text-green-400" : "text-slate-400"}`}>
                  <span className={`h-2 w-2 rounded-full ${selectedAdmin.isOnline ? "bg-green-400" : "bg-slate-500"}`} />
                  {selectedAdmin.isOnline ? "Conectado" : "Desconectado"}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Shield className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Privado</span>
            </div>
          </div>

          <div className="relative">
            <div
              ref={chatScrollRef}
              className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/60 p-4 min-h-[320px] max-h-[440px] overflow-y-auto"
              onScroll={(event) => {
                const element = event.currentTarget;
                const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
                setShowScrollButton(!isNearBottom && chatHistory.length > 0);
              }}
            >
              {chatHistory.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Nenhuma conversa registrada com este administrador.
                </div>
              ) : (
                chatHistory.map((item) => {
                  const isMine = item.senderId === currentAdmin?.id;
                  return (
                    <div key={item.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`relative max-w-[80%] rounded-2xl px-3 py-2 ${isMine ? "bg-orange-600 text-white" : "bg-slate-800 text-slate-100"}`}>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMessageId(item.id)}
                          className="absolute -right-2 -top-2 rounded-full border border-red-200 bg-white p-1 text-red-600 hover:bg-red-50"
                          aria-label="Eliminar mensagem do chat"
                          title="Eliminar mensagem"
                        >
                          <span className="text-xs leading-none">×</span>
                        </button>
                        <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide opacity-80">
                          <span>{isMine ? "Você" : item.senderName}</span>
                          <span>•</span>
                          <span>{item.senderRole === "super_admin" ? "Superadministrador" : "Administrador"}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{item.text}</p>
                        <div className="mt-2 text-[10px] opacity-70 text-right">
                          {new Date(item.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </div>
                      </div>
                      {confirmDeleteMessageId === item.id && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/10">
                          <div className="rounded-lg border border-red-200 bg-white p-3 shadow-lg">
                            <p className="mb-3 text-sm font-medium text-red-700">Deseja eliminar esta mensagem?</p>
                            <div className="flex gap-2">
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteChatMessage(item.id)}>
                                Confirmar
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteMessageId(null)}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {showScrollButton && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={scrollToBottom}
                className="absolute bottom-4 right-4 z-10 h-10 w-10 rounded-full border border-slate-600 bg-slate-800 text-slate-100 shadow-lg hover:bg-slate-700"
                aria-label="Ir para o fim do chat"
                title="Ir para o fim do chat"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="mt-4">
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Escreva uma mensagem interna..."
              className="min-h-[120px] bg-slate-900/80 text-white"
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={sendMessage} disabled={sending || !selectedAdminId}>
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <AdminLayout title="Chat administrativo" subtitle="Comunicação interna entre administradores e superadministradores">
      {content}
    </AdminLayout>
  );
};
