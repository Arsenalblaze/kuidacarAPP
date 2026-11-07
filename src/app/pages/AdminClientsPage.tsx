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
import {
  Search,
  RefreshCcw,
  Lock,
  Unlock,
  Zap,
} from "lucide-react";
import { apiClient } from "../utils/api";
import { toast } from "sonner";

interface AdminClient {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  isOnline: boolean;
  isBlocked: boolean;
  createdAt?: string | null;
}

export const AdminClientsPage = () => {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAdminClientList(search);
      if (response.success) {
        setClients(response.clients);
      } else {
        toast.error("Não foi possível carregar os clientes.");
      }
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      toast.error("Erro ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  };

  const toggleBlock = async (client: AdminClient) => {
    try {
      setActionLoadingId(client.id);
      if (client.isBlocked) {
        await apiClient.unblockClient(client.id);
        toast.success(`Cliente ${client.name} desbloqueado com sucesso.`);
      } else {
        await apiClient.blockClient(client.id);
        toast.success(`Cliente ${client.name} bloqueado com sucesso.`);
      }
      setClients((current) =>
        current.map((item) =>
          item.id === client.id
            ? { ...item, isBlocked: !item.isBlocked }
            : item,
        ),
      );
    } catch (error) {
      console.error("Erro ao atualizar status de bloqueio:", error);
      toast.error("Não foi possível atualizar o bloqueio do cliente.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const blockedCount = clients.filter((client) => client.isBlocked).length;

  return (
    <AdminLayout title="Clientes" subtitle="Gerenciar e bloquear clientes">
      <div className="space-y-6">
        <Card className="bg-slate-900 border-slate-700 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-slate-400 text-sm">Gerencie clientes cadastrados e bloqueie usuários quando necessário.</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">Clientes carregados: {clients.length}</span>
                <span className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">Bloqueados: {blockedCount}</span>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, e-mail ou telefone"
                  className="pl-10 text-white placeholder:text-slate-400"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      loadClients();
                    }
                  }}
                />
              </div>
              <Button
                onClick={loadClients}
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
              <Zap className="mr-3 h-5 w-5 animate-spin" /> Carregando clientes...
            </div>
          ) : clients.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-slate-400">
              Nenhum cliente encontrado.
            </div>
          ) : (
            <Table className="min-w-full border border-slate-700">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Bloqueado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell><span className="text-white">{client.name || client.id}</span></TableCell>
                    <TableCell><span className="text-white">{client.email || '-'}</span></TableCell>
                    <TableCell><span className="text-white">{client.phone || '-'}</span></TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${client.isOnline ? 'bg-green-500/15 text-green-200' : 'bg-slate-700 text-slate-300'}`}>
                        {client.isOnline ? 'Conectado' : 'Desconectado'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${client.isBlocked ? 'bg-red-500/15 text-red-200' : 'bg-green-500/10 text-green-200'}`}>
                        {client.isBlocked ? 'Sim' : 'Não'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => toggleBlock(client)}
                        disabled={actionLoadingId === client.id}
                        variant={client.isBlocked ? 'secondary' : 'destructive'}
                        className="inline-flex items-center gap-2"
                      >
                        {client.isBlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        {client.isBlocked ? 'Desbloquear' : 'Bloquear'}
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
  );
};
