import { useEffect, useState } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { apiClient } from "../utils/api";
import { toast } from "sonner";
import {
  FileText,
  Trash2,
  MessageSquare,
  User,
  Wrench,
  MapPin,
  Clock3,
  Loader2,
} from "lucide-react";

interface AdminRequest {
  id: string;
  customerId?: string;
  providerId?: string;
  customerName: string;
  customerPhone?: string;
  providerName: string;
  providerPhone?: string;
  mechanicName?: string;
  type: string;
  description: string;
  location?: { lat?: number; lng?: number; address?: string };
  providerLocation?: { lat?: number; lng?: number };
  estimatedPrice?: number;
  finalPrice?: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export const AdminRequestsPage = () => {
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAllServiceRequests();
      if (response.success) {
        setRequests(response.requests || []);
      } else {
        setRequests([]);
        toast.error("Não foi possível carregar as solicitações.");
      }
    } catch (error: any) {
      console.error("Erro ao carregar solicitações do admin:", error);
      setRequests([]);
      toast.error(error?.message || "Erro ao carregar solicitações.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    const confirmed = window.confirm("Deseja realmente remover esta solicitação?");
    if (!confirmed) return;

    try {
      setDeletingId(requestId);
      const response = await apiClient.deleteServiceRequest(requestId);
      if (response.success) {
        setRequests((current) => current.filter((request) => request.id !== requestId));
        toast.success("Solicitação removida com sucesso.");
      }
    } catch (error: any) {
      console.error("Erro ao remover solicitação:", error);
      toast.error(error?.message || "Erro ao remover solicitação.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSendMessage = async (requestId: string, receiverId: string, label: string) => {
    const content = window.prompt(`Mensagem para ${label}:`);
    if (!content || !content.trim()) return;

    try {
      setSendingId(requestId);
      await apiClient.sendMessage(
        `admin-${requestId}-${receiverId}-${Date.now()}`,
        receiverId,
        content.trim()
      );
      toast.success(`Mensagem enviada para ${label}.`);
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error(error?.message || "Erro ao enviar mensagem.");
    } finally {
      setSendingId(null);
    }
  };

  const filteredRequests = requests.filter((request) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;

    const customerMatch = (request.customerName || "").toLowerCase().includes(query);
    const mechanicMatch = (request.providerName || request.mechanicName || "").toLowerCase().includes(query);

    return customerMatch || mechanicMatch;
  });

  const formatDate = (value?: string) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <AdminLayout title="Solicitações" subtitle="Visualizar, responder e gerenciar solicitações do sistema">
      <div className="space-y-6">
        <Card className="border-slate-700 bg-slate-900 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-slate-300" />
              <div>
                <p className="text-sm text-slate-400">Total de solicitações</p>
                <p className="text-2xl font-bold text-white">{filteredRequests.length}</p>
              </div>
            </div>

            <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar por cliente ou mecânico"
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
              />
              <Button variant="outline" onClick={loadRequests}>
                Atualizar
              </Button>
            </div>
          </div>
        </Card>

        {loading ? (
          <Card className="border-slate-700 bg-slate-900 p-10">
            <div className="flex items-center justify-center gap-3 text-slate-300">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Carregando solicitações...</span>
            </div>
          </Card>
        ) : filteredRequests.length === 0 ? (
          <Card className="border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
            Nenhuma solicitação encontrada para a pesquisa atual.
          </Card>
        ) : (
          <div className="max-h-[620px] space-y-4 overflow-y-auto pr-1">
            {filteredRequests.map((request) => (
              <Card key={request.id} className="border-slate-700 bg-slate-900 p-5">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-medium text-slate-200">
                        {request.type}
                      </span>
                      <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-200">
                        {request.status}
                      </span>
                    </div>

                    <div>
                      <p className="text-sm text-slate-400">ID</p>
                      <p className="font-mono text-sm text-slate-200 break-all">{request.id}</p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <User className="w-4 h-4 text-blue-400" />
                        <span>
                          Cliente: <strong>{request.customerName}</strong>
                          {request.customerPhone ? ` • ${request.customerPhone}` : ""}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Wrench className="w-4 h-4 text-green-400" />
                        <span>
                          Mecânico: <strong>{request.providerName || request.mechanicName || "Não atribuído"}</strong>
                          {request.providerPhone ? ` • ${request.providerPhone}` : ""}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm text-slate-300">
                      <p className="flex items-center gap-2">
                        <Clock3 className="w-4 h-4 text-slate-400" />
                        Criada em: {formatDate(request.createdAt)}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock3 className="w-4 h-4 text-slate-400" />
                        Atualizada em: {formatDate(request.updatedAt)}
                      </p>
                    </div>

                    {request.location?.address && (
                      <div className="flex items-start gap-2 text-sm text-slate-300">
                        <MapPin className="w-4 h-4 mt-0.5 text-slate-400" />
                        <span>{request.location.address}</span>
                      </div>
                    )}

                    <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-300">
                      <p className="mb-1 font-medium text-white">Descrição</p>
                      <p className="whitespace-pre-wrap">{request.description || "Sem descrição."}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 text-sm text-slate-300">
                      <div>
                        <p className="text-slate-400">Preço estimado</p>
                        <p className="font-semibold text-white">{request.estimatedPrice ? `${request.estimatedPrice} Kz` : "-"}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Preço final</p>
                        <p className="font-semibold text-white">{request.finalPrice ? `${request.finalPrice} Kz` : "-"}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Mecânico nome</p>
                        <p className="font-semibold text-white">{request.mechanicName || "-"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 min-w-[210px]">
                    {request.customerId && (
                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => handleSendMessage(request.id, request.customerId!, "cliente")}
                        disabled={sendingId === request.id}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        {sendingId === request.id ? "Enviando..." : "Mensagem ao cliente"}
                      </Button>
                    )}

                    {request.providerId && (
                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => handleSendMessage(request.id, request.providerId!, "mecânico")}
                        disabled={sendingId === request.id}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Mensagem ao mecânico
                      </Button>
                    )}

                    <Button
                      variant="destructive"
                      className="justify-start"
                      onClick={() => handleDeleteRequest(request.id)}
                      disabled={deletingId === request.id}
                    >
                      {deletingId === request.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      {deletingId === request.id ? "Excluindo..." : "Eliminar"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
