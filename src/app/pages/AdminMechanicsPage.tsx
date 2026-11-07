import { useEffect, useState } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../components/ui/table";
import { Search, RefreshCcw, Lock, Unlock, Zap, Wrench, FileImage, Eye } from "lucide-react";
import { apiClient } from "../utils/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

interface AdminMechanic {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  status?: string;
  isOnline: boolean;
  isBlocked: boolean;
  providerType?: string | null;
  vehicleModel?: string | null;
  vehiclePlate?: string | null;
  documentType?: string | null;
  documentUrl?: string | null;
  debt?: number | null;
  createdAt?: string | null;
}

export const AdminMechanicsPage = () => {
  const [mechanics, setMechanics] = useState<AdminMechanic[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<{ id: string; name: string; type?: string | null; url: string } | null>(null);
  const [seenDocuments, setSeenDocuments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadMechanics();
  }, []);

  const loadMechanics = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAdminMechanicList(search);
      if (response.success) {
        setMechanics(response.mechanics);
      } else {
        toast.error("Não foi possível carregar os mecânicos.");
      }
    } catch (error) {
      console.error("Erro ao carregar mecânicos:", error);
      toast.error("Erro ao carregar mecânicos.");
    } finally {
      setLoading(false);
    }
  };

  const isMechanicBlocked = (mechanic: AdminMechanic) => {
    return mechanic.isBlocked;
  };

  const toggleBlock = async (mechanic: AdminMechanic) => {
    try {
      setActionLoadingId(mechanic.id);
      const blockedNow = isMechanicBlocked(mechanic);

      if (blockedNow) {
        const response = await apiClient.unblockClient(mechanic.id);
        if (!response.success) {
          throw new Error(response.error || 'Não foi possível desbloquear o mecânico.');
        }
        toast.success(`Mecânico ${mechanic.name} desbloqueado com sucesso.`);
      } else {
        const response = await apiClient.blockClient(mechanic.id);
        if (!response.success) {
          throw new Error(response.error || 'Não foi possível bloquear o mecânico.');
        }
        toast.success(`Mecânico ${mechanic.name} bloqueado com sucesso.`);
      }

      await loadMechanics();
    } catch (error) {
      console.error("Erro ao atualizar status de bloqueio:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o bloqueio do mecânico.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const blockedCount = mechanics.filter((mechanic) => isMechanicBlocked(mechanic)).length;

  const handleStatusChange = async (mechanic: AdminMechanic, nextStatus: string) => {
    try {
      setActionLoadingId(mechanic.id);
      const response = await apiClient.setProviderStatus(mechanic.id, nextStatus);

      if (!response?.success) {
        throw new Error('Não foi possível atualizar o status do mecânico.');
      }

      setMechanics((current) =>
        current.map((item) =>
          item.id === mechanic.id
            ? {
                ...item,
                status: nextStatus,
                isOnline: nextStatus !== 'offline',
              }
            : item,
        ),
      );

      const label = {
        available: 'Disponível',
        occupied: 'Ocupado',
        offline: 'Desconectado',
      }[nextStatus] || nextStatus;

      toast.success(`Status de ${mechanic.name} atualizado para ${label}.`);
    } catch (error) {
      console.error('Erro ao atualizar status do mecânico:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o status do mecânico.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenDocument = (mechanic: AdminMechanic) => {
    if (!mechanic.documentUrl) {
      toast.info('Este mecânico não possui documento anexado.');
      return;
    }

    setSeenDocuments((current) => ({ ...current, [mechanic.id]: true }));
    setSelectedDocument({
      id: mechanic.id,
      name: mechanic.name,
      type: mechanic.documentType,
      url: mechanic.documentUrl,
    });
  };

  return (
    <>
      <Dialog open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden bg-slate-950 text-white border-slate-700">
          <DialogHeader>
            <DialogTitle>Documento do mecânico</DialogTitle>
          </DialogHeader>

          {selectedDocument && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                <div>
                  <p className="text-sm text-slate-400">Mecânico</p>
                  <p className="font-medium text-white">{selectedDocument.name}</p>
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200">
                  {selectedDocument.type ? selectedDocument.type.replace('_', ' ') : 'Documento'}
                </span>
              </div>

              <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-4">
                <img
                  src={selectedDocument.url}
                  alt={`Documento de ${selectedDocument.name}`}
                  className="max-h-[65vh] max-w-full rounded-md object-contain shadow-lg"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AdminLayout title="Mecânicos" subtitle="Gerenciar e visualizar mecânicos">
      <div className="space-y-6">
        <Card className="bg-slate-900 border-slate-700 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-slate-400 text-sm">Lista de mecânicos cadastrados, com status de bloqueio e presença online.</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">Mecânicos carregados: {mechanics.length}</span>
                <span className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">Bloqueados: {blockedCount}</span>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar mecânico por nome, email, veículo..."
                  className="pl-10 text-white placeholder:text-slate-400"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      loadMechanics();
                    }
                  }}
                />
              </div>
              <Button
                onClick={loadMechanics}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900 border-slate-700 p-4">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-slate-400">
              <Zap className="mr-3 h-5 w-5 animate-spin" /> Carregando mecânicos...
            </div>
          ) : mechanics.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-slate-400">
              Nenhum mecânico encontrado.
            </div>
          ) : (
            <Table className="min-w-full border border-slate-700">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Dívida</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Bloqueado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mechanics.map((mechanic) => (
                  <TableRow key={mechanic.id}>
                    <TableCell><span className="text-white">{mechanic.name || mechanic.id}</span></TableCell>
                    <TableCell><span className="text-white">{mechanic.email || '-'}</span></TableCell>
                    <TableCell><span className="text-white">{mechanic.phone || '-'}</span></TableCell>
                    <TableCell><span className="text-white">{mechanic.providerType || '-'}</span></TableCell>
                    <TableCell><span className="text-white">{mechanic.vehicleModel ? `${mechanic.vehicleModel} / ${mechanic.vehiclePlate || '-'}` : '-'}</span></TableCell>
                    <TableCell>
                      {mechanic.documentUrl ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDocument(mechanic)}
                          className={`inline-flex items-center gap-2 border-slate-600 bg-slate-950 text-white ${!seenDocuments[mechanic.id] ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900' : ''}`}
                        >
                          <FileImage className="h-4 w-4" />
                          <span>{mechanic.documentType ? mechanic.documentType.replace('_', ' ') : 'Documento'}</span>
                          {!seenDocuments[mechanic.id] && <Eye className="h-3.5 w-3.5 text-yellow-300" />}
                        </Button>
                      ) : (
                        <span className="text-slate-400">Sem documento</span>
                      )}
                    </TableCell>
                    <TableCell><span className="text-white">{Number(mechanic.debt || 0).toLocaleString('pt-AO', { maximumFractionDigits: 0 })} Kz</span></TableCell>
                    <TableCell>
                      <select
                        value={mechanic.status || (mechanic.isOnline ? 'available' : 'offline')}
                        disabled={actionLoadingId === mechanic.id || isMechanicBlocked(mechanic)}
                        onChange={(event) => handleStatusChange(mechanic, event.target.value)}
                        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none ring-0 focus:border-orange-500"
                      >
                        {isMechanicBlocked(mechanic) && <option value="blocked">Bloqueado</option>}
                        <option value="available">Disponível</option>
                        <option value="occupied">Ocupado</option>
                        <option value="offline">Desconectado</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${isMechanicBlocked(mechanic) ? 'bg-red-500/15 text-red-200' : 'bg-green-500/10 text-green-200'}`}>
                        {isMechanicBlocked(mechanic) ? 'Sim' : 'Não'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => toggleBlock(mechanic)}
                        disabled={actionLoadingId === mechanic.id}
                        variant={isMechanicBlocked(mechanic) ? 'secondary' : 'destructive'}
                        className="inline-flex items-center gap-2"
                      >
                        {isMechanicBlocked(mechanic) ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        {isMechanicBlocked(mechanic) ? 'Desbloquear' : 'Bloquear'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AdminLayout>
    </>
  );
};
