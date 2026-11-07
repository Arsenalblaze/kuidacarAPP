import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { apiClient, supabase } from "../utils/api";
import { SupportTicketResponseModal } from "../components/SupportTicketResponseModal";
import { toast } from "sonner";
import {
  MessageSquare,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Eye,
  Search,
} from "lucide-react";

type TicketStatus = "Aberto" | "Respondido" | "Fechado" | "A responder";

interface Ticket {
  id: string;
  cliente_id: string;
  cliente_nome?: string;
  categoria: string;
  assunto: string;
  mensagem: string;
  resposta_admin?: string | null;
  status: TicketStatus;
  data_envio: string;
  data_resposta?: string | null;
}

const statusOptions: Array<{ label: string; value: TicketStatus | "Todos" }> = [
  { label: "Todos", value: "Todos" },
  { label: "Aberto", value: "Aberto" },
  { label: "Respondido", value: "Respondido" },
  { label: "Fechado", value: "Fechado" },
];

const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export const AdminComplaintsPage = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "Todos">("Todos");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [respondingMap, setRespondingMap] = useState<Record<string, any>>({});
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [ticketToDeleteId, setTicketToDeleteId] = useState<string | null>(null);
  const [showDeleteAllTicketsConfirm, setShowDeleteAllTicketsConfirm] = useState(false);

  useEffect(() => {
    loadTickets();
    // subscribe to responding flags
    let sub: any = null;
    (async () => {
      try {
        const { data: authUser } = await supabase.auth.getUser();
        setCurrentAdminId(authUser?.user?.id ?? null);

        sub = supabase
          .channel('responding_flags_complaints')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kv_store_9dc5328a', filter: `key=like.responding:%` }, (payload) => {
            const kv = (payload as any).new;
            if (!kv || !kv.key) return;
            setRespondingMap((cur) => ({ ...cur, [kv.key]: kv.value }));
            try {
              const val = kv.value || {};
              if (val.adminId && val.adminId !== currentAdminId) {
                toast(`${val.adminName || 'Um administrador'} está a responder`);
              }
            } catch (e) {}
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kv_store_9dc5328a', filter: `key=like.responding:%` }, (payload) => {
            const kv = (payload as any).new;
            if (!kv || !kv.key) return;
            setRespondingMap((cur) => ({ ...cur, [kv.key]: kv.value }));
            try {
              const val = kv.value || {};
              if (val.adminId && val.adminId !== currentAdminId) {
                toast(`${val.adminName || 'Um administrador'} está a responder`);
              }
            } catch (e) {}
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'kv_store_9dc5328a', filter: `key=like.responding:%` }, (payload) => {
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
            } catch (e) {}
          })
          .subscribe();
      } catch (e) {
        console.warn('Erro ao subscrever responding flags (complaints):', e);
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

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAllSupportTickets();
      if (response.success) {
        const raw: any[] = response.tickets || [];
        const enriched = await Promise.all(raw.map(async (t) => {
          const userResp = await apiClient.getUserById(t.cliente_id);
          return { ...t, cliente_nome: userResp?.user?.name || t.cliente_id };
        }));
        setTickets(enriched as Ticket[]);
      } else {
        toast.error("Não foi possível carregar os tickets de suporte.");
      }
    } catch (error) {
      console.error("Erro ao carregar tickets:", error);
      toast.error("Erro ao carregar tickets de suporte.");
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    let base = tickets;
    if (filterStatus !== "Todos") base = base.filter((ticket) => ticket.status === filterStatus);
    if (!q) return base;
    return base.filter((ticket) => {
      const name = String(ticket.cliente_nome || ticket.cliente_id || "").toLowerCase();
      const message = String(ticket.mensagem || "").toLowerCase();
      const subject = String(ticket.assunto || "").toLowerCase();
      return name.includes(q) || message.includes(q) || subject.includes(q);
    });
  }, [tickets, filterStatus, searchQuery]);

  const activeCount = tickets.filter((ticket) => ticket.status === "Aberto").length;
  const respondedCount = tickets.filter((ticket) => ticket.status === "Respondido").length;
  const closedCount = tickets.filter((ticket) => ticket.status === "Fechado").length;

  const handleOpenResponse = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setModalOpen(true);
  };

  const handleSubmitResponse = async (ticketId: string, resposta_admin: string) => {
    try {
      await apiClient.respondToSupportTicket(ticketId, resposta_admin);
      toast.success("Resposta enviada com sucesso.");
      await loadTickets();
    } catch (error) {
      console.error("Erro ao responder ticket:", error);
      toast.error("Erro ao enviar resposta.");
    }
  };

  const handleUpdateStatus = async (ticketId: string, status: TicketStatus) => {
    try {
      setStatusUpdatingId(ticketId);
      await apiClient.updateSupportTicketStatus(ticketId, status);
      toast.success(`Ticket marcado como ${status}.`);
      await loadTickets();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      const response = await apiClient.deleteSupportTicket(ticketId);
      if (!response.success) {
        throw new Error(response.error || 'Erro ao eliminar ticket.');
      }

      setTickets((current) => current.filter((ticket) => ticket.id !== ticketId));
      setTicketToDeleteId(null);
      toast.success('Ticket eliminado com sucesso.');
    } catch (error: any) {
      console.error('Erro ao eliminar ticket:', error);
      toast.error(error?.message || 'Não foi possível eliminar o ticket.');
    }
  };

  const handleDeleteAllTickets = async () => {
    try {
      const response = await apiClient.deleteAllSupportTickets();
      if (!response.success) {
        throw new Error(response.error || 'Erro ao eliminar todos os tickets.');
      }

      setTickets([]);
      setShowDeleteAllTicketsConfirm(false);
      toast.success('Todos os tickets foram eliminados.');
    } catch (error: any) {
      console.error('Erro ao eliminar todos os tickets:', error);
      toast.error(error?.message || 'Não foi possível eliminar todos os tickets.');
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    if (status === "Aberto") return <Badge className="bg-yellow-500 text-slate-900">Aberto</Badge>;
    if (status === "A responder") return <Badge className="bg-amber-400 text-slate-900">A responder</Badge>;
    if (status === "Respondido") return <Badge className="bg-green-500 text-white">Respondido</Badge>;
    return <Badge className="bg-slate-600 text-white">Fechado</Badge>;
  };

  const getTicketStatusBar = (ticket: Ticket) => {
    const isResponding = Boolean(respondingMap[`responding:ticket:${ticket.id}`]);

    if (isResponding) {
      return {
        label: "A responder",
        className: "bg-amber-400 text-slate-900 border-amber-300",
      };
    }

    if (ticket.status === "Respondido") {
      return {
        label: "Respondido",
        className: "bg-emerald-500 text-white border-emerald-400",
      };
    }

    if (ticket.status === "Fechado") {
      return {
        label: "Fechado",
        className: "bg-slate-600 text-white border-slate-500",
      };
    }

    return {
      label: "Aberta",
      className: "bg-yellow-500 text-slate-900 border-yellow-400",
    };
  };

  return (
    <AdminLayout title="Reclamações" subtitle="Gerenciar tickets de suporte">
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-7 h-7 text-blue-400" />
              <div>
                <p className="text-slate-400 text-sm">Total de Tickets</p>
                <p className="text-2xl font-bold text-white">{tickets.length}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-yellow-500/10 border-yellow-500/20 p-4">
            <div className="flex items-center gap-3">
              <ArrowRight className="w-7 h-7 text-yellow-400" />
              <div>
                <p className="text-slate-400 text-sm">Abertos</p>
                <p className="text-2xl font-bold text-white">{activeCount}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-green-500/10 border-green-500/20 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-7 h-7 text-green-400" />
              <div>
                <p className="text-slate-400 text-sm">Respondidos</p>
                <p className="text-2xl font-bold text-white">{respondedCount}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-slate-700/10 border-slate-700/20 p-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-7 h-7 text-slate-300" />
              <div>
                <p className="text-slate-400 text-sm">Fechados</p>
                <p className="text-2xl font-bold text-white">{closedCount}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 w-full">
                <div>
                  <p className="text-slate-400 text-sm">Filtrar por estado</p>
                  <Select
                    value={filterStatus}
                    onValueChange={(value) => setFilterStatus(value as TicketStatus | "Todos")}
                    className="mt-2 w-full md:w-56"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative w-full sm:w-80 mt-3 sm:mt-0">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar por nome ou mensagem"
                    className="pl-10 bg-slate-900/80 text-white w-full"
                    onKeyDown={(e) => { if (e.key === 'Enter') loadTickets(); }}
                  />
                </div>

                <div className="mt-3 sm:mt-0 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={loadTickets}
                    className="w-full md:w-auto"
                  >
                    Atualizar tickets
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteAllTicketsConfirm(true)}
                    className="w-full md:w-auto"
                    disabled={tickets.length === 0}
                  >
                    Eliminar todos
                  </Button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-72 rounded-xl border border-slate-700 bg-slate-950">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <Card className="bg-slate-900 border-slate-700 p-8 text-center text-slate-400">
                Nenhum ticket encontrado para o filtro selecionado.
              </Card>
            ) : (
              <div className="max-h-[620px] space-y-4 overflow-y-auto pr-1">
                {filteredTickets.map((ticket) => {
                  const ticketStatusBar = getTicketStatusBar(ticket);

                  return (
                    <Card
                      key={ticket.id}
                      className="border-slate-700 bg-slate-950 p-5"
                    >
                      <div className="mb-3">
                        <div className={`inline-flex w-full max-w-[220px] items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold ${ticketStatusBar.className}`}>
                          {ticketStatusBar.label}
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-white truncate">
                              {ticket.assunto}
                            </h3>
                            {respondingMap[`responding:ticket:${ticket.id}`] ? (
                              <Badge className="bg-amber-400 text-slate-900">A responder</Badge>
                            ) : (
                              getStatusBadge(ticket.status)
                            )}
                          </div>

                          <p className="text-slate-400 text-sm mt-2">
                            <span className="font-medium text-slate-200">Categoria:</span> {ticket.categoria}
                          </p>
                          <p className="text-slate-400 text-sm mt-1">
                            <span className="font-medium text-slate-200">Cliente:</span> {ticket.cliente_nome || ticket.cliente_id}
                          </p>
                          <p className="text-slate-400 text-sm mt-1">
                            <span className="font-medium text-slate-200">Enviado em:</span> {formatDate(ticket.data_envio)}
                          </p>

                          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-slate-300 whitespace-pre-line">
                            {ticket.mensagem}
                          </div>

                          {ticket.resposta_admin ? (
                            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-slate-200">
                              <div className="flex items-center gap-2 text-slate-300 mb-2">
                                <Eye className="w-4 h-4" />
                                <span className="text-sm font-medium">Resposta anterior</span>
                              </div>
                              <p className="whitespace-pre-line text-slate-300">{ticket.resposta_admin}</p>
                              {ticket.data_resposta ? (
                                <p className="text-xs text-slate-500 mt-2">
                                  Respondido em {formatDate(ticket.data_resposta)}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-col gap-2 sm:w-56">
                          <Button
                            variant="outline"
                            onClick={() => handleOpenResponse(ticket)}
                          >
                            Responder
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => handleUpdateStatus(ticket.id, ticket.status === "Fechado" ? "Aberto" : "Fechado")}
                            disabled={statusUpdatingId === ticket.id}
                          >
                            {statusUpdatingId === ticket.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : ticket.status === "Fechado" ? (
                              "Reabrir"
                            ) : (
                              "Fechar"
                            )}
                          </Button>
                          {ticket.status !== "Aberto" ? (
                            <Button
                              variant="secondary"
                              onClick={() => handleUpdateStatus(ticket.id, "Aberto")}
                              disabled={statusUpdatingId === ticket.id}
                            >
                              Reabrir
                            </Button>
                          ) : null}

                          {ticketToDeleteId === ticket.id ? (
                            <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-2">
                              <p className="mb-2 text-xs font-medium text-red-200">Confirmar eliminação?</p>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteTicket(ticket.id)}
                                >
                                  Sim
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setTicketToDeleteId(null)}
                                >
                                  Não
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="destructive"
                              onClick={() => setTicketToDeleteId(ticket.id)}
                            >
                              Eliminar
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <Card className="bg-slate-900 border-slate-700 p-5">
            <div className="space-y-4">
              <div>
                <p className="text-slate-400 text-sm">Resumo rápido</p>
                <h2 className="text-2xl font-bold text-white mt-2">Tickets de suporte</h2>
              </div>
              <div className="grid gap-3">
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <p className="text-slate-400 text-sm">Total</p>
                  <p className="text-3xl font-semibold text-white">{tickets.length}</p>
                </div>
                <div className="rounded-xl border border-yellow-600/30 bg-yellow-950/20 p-4">
                  <p className="text-slate-400 text-sm">Abertos</p>
                  <p className="text-3xl font-semibold text-white">{activeCount}</p>
                </div>
                <div className="rounded-xl border border-green-600/30 bg-green-950/20 p-4">
                  <p className="text-slate-400 text-sm">Respondidos</p>
                  <p className="text-3xl font-semibold text-white">{respondedCount}</p>
                </div>
                <div className="rounded-xl border border-slate-600/30 bg-slate-950/20 p-4">
                  <p className="text-slate-400 text-sm">Fechados</p>
                  <p className="text-3xl font-semibold text-white">{closedCount}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {showDeleteAllTicketsConfirm && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-100">
          <p className="font-medium">Deseja eliminar todos os tickets?</p>
          <div className="mt-3 flex gap-2">
            <Button variant="destructive" onClick={handleDeleteAllTickets}>
              Confirmar
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteAllTicketsConfirm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <SupportTicketResponseModal
        isOpen={modalOpen}
        ticket={selectedTicket}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmitResponse}
      />
    </AdminLayout>
  );
};
