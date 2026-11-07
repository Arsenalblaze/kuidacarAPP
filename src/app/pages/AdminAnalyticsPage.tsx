import { useEffect, useState } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../components/ui/table";
import {
  BarChart3,
  RefreshCcw,
  Save,
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock3,
  Activity,
  AlertTriangle,
  Database,
} from "lucide-react";
import { apiClient } from "../utils/api";
import { toast } from "sonner";

interface AdminStatistics {
  totalClients: number;
  totalMechanics: number;
  totalAdmins: number;
  totalServices: number;
  servicesPending: number;
  servicesInProgress: number;
  servicesCompleted: number;
  servicesCancelled: number;
  activeMechanics: number;
  inactiveMechanics: number;
  onlineMechanics: number;
  offlineMechanics: number;
  clientsOnline?: number;
}

interface AdminStatisticsSnapshot {
  id: string;
  snapshot: AdminStatistics;
  created_at: string;
}

export const AdminAnalyticsPage = () => {
  const [stats, setStats] = useState<AdminStatistics | null>(null);
  const [snapshots, setSnapshots] = useState<AdminStatisticsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  useEffect(() => {
    loadStatistics();
    loadSnapshots();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAdminDashboardStats();
      if (response.success) {
        setStats(response.stats);
      } else {
        toast.error("Não foi possível carregar as estatísticas.");
      }
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
      toast.error("Erro ao carregar estatísticas.");
    } finally {
      setLoading(false);
    }
  };

  const loadSnapshots = async () => {
    try {
      const response = await apiClient.getAdminStatisticsSnapshots();
      if (response.success) {
        setSnapshots(response.snapshots || []);
      }
    } catch (error) {
      console.error("Erro ao carregar snapshots de estatísticas:", error);
    }
  };

  const handleSaveSnapshot = async () => {
    if (!stats) {
      toast.error("Nenhuma estatística disponível para salvar.");
      return;
    }

    try {
      setSavingSnapshot(true);
      const response = await apiClient.saveAdminStatisticsSnapshot(stats);
      if (response.success) {
        toast.success("Registo das estatísticas guardado com sucesso.");
        await loadSnapshots();
      } else {
        toast.error("Erro ao guardar o registo das estatísticas.");
      }
    } catch (error) {
      console.error("Erro ao salvar snapshot de estatísticas:", error);
      toast.error("Erro ao guardar o registo das estatísticas.");
    } finally {
      setSavingSnapshot(false);
    }
  };

  const formatDate = (value: string) => {
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AdminLayout title="Estatísticas" subtitle="Painel administrativo de indicadores">
      <div className="space-y-6">
        <Card className="bg-slate-900 border-slate-700 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-slate-400 text-sm">
                Métricas-chave de clientes, técnicos e serviços.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                onClick={loadStatistics}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCcw className="w-4 h-4" />
                Atualizar métricas
              </Button>
              <Button
                onClick={handleSaveSnapshot}
                disabled={savingSnapshot || !stats}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar snapshot
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="bg-blue-500/10 border-blue-500/20 p-4">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-400" />
              <div>
                <p className="text-slate-400 text-sm">Clientes registrados</p>
                <p className="text-2xl font-bold text-white">{stats?.totalClients ?? 0}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-green-500/10 border-green-500/20 p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-slate-400 text-sm">Administradores</p>
                <p className="text-2xl font-bold text-white">{stats?.totalAdmins ?? 0}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-orange-500/10 border-orange-500/20 p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-orange-400" />
              <div>
                <p className="text-slate-400 text-sm">Técnicos cadastrados</p>
                <p className="text-2xl font-bold text-white">{stats?.totalMechanics ?? 0}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-800/80 border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-slate-300" />
              <div>
                <p className="text-white text-sm">Serviços totais</p>
                <p className="text-2xl font-bold text-white">{stats?.totalServices ?? 0}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <p className="text-slate-400 text-sm">Pendentes</p>
            <p className="mt-3 text-3xl font-semibold text-white">{stats?.servicesPending ?? 0}</p>
          </Card>
          <Card className="bg-blue-900/70 border-blue-700 p-4">
            <p className="text-white text-sm">Em andamento</p>
            <p className="mt-3 text-3xl font-semibold text-white">{stats?.servicesInProgress ?? 0}</p>
          </Card>
          <Card className="bg-green-900/70 border-green-700 p-4">
            <p className="text-white text-sm">Concluídos</p>
            <p className="mt-3 text-3xl font-semibold text-white">{stats?.servicesCompleted ?? 0}</p>
          </Card>
          <Card className="bg-red-900/70 border-red-700 p-4">
            <p className="text-white text-sm">Cancelados</p>
            <p className="mt-3 text-3xl font-semibold text-white">{stats?.servicesCancelled ?? 0}</p>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card className="bg-green-900/70 border-green-700 p-4">
            <p className="text-white text-sm">Técnicos ativos</p>
            <p className="mt-3 text-3xl font-semibold text-white">{stats?.activeMechanics ?? 0}</p>
          </Card>
          <Card className="bg-slate-800/70 border-slate-700 p-4">
            <p className="text-white text-sm">Técnicos inativos</p>
            <p className="mt-3 text-3xl font-semibold text-white">{stats?.inactiveMechanics ?? 0}</p>
          </Card>
          <Card className="bg-blue-900/70 border-blue-700 p-4">
            <p className="text-white text-sm">Conectados</p>
            <p className="mt-3 text-3xl font-semibold text-white">{stats?.onlineMechanics ?? 0}</p>
          </Card>
          <Card className="bg-slate-900/70 border-slate-700 p-4">
            <p className="text-slate-400 text-sm">Desconectados</p>
            <p className="mt-3 text-3xl font-semibold text-white">{stats?.offlineMechanics ?? 0}</p>
          </Card>
        </div>

        <Card className="bg-slate-900 border-slate-700 p-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-white font-semibold">Registos das estatísticas</p>
              <p className="text-slate-400 text-sm">Registros salvos de métricas administrativas.</p>
            </div>
            <div className="inline-flex items-center gap-2 text-slate-400 text-sm">
              <Clock3 className="w-4 h-4" />
              Últimos {snapshots.length}
            </div>
          </div>

          {snapshots.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-slate-400">
              Ainda não há registos guardados.
            </div>
          ) : (
            <Table className="min-w-full border border-slate-700">
              <TableHeader>
                <TableRow>
                  <TableHead>Salvo em</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead>Técnicos</TableHead>
                  <TableHead>Administradores</TableHead>
                  <TableHead>Serviços</TableHead>
                  <TableHead className="text-right">Pend/And/Comp/Can</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((snapshot) => (
                  <TableRow key={snapshot.id}>
                    <TableCell>{formatDate(snapshot.created_at)}</TableCell>
                    <TableCell>{snapshot.snapshot.totalClients}</TableCell>
                    <TableCell>{snapshot.snapshot.totalMechanics}</TableCell>
                    <TableCell>{snapshot.snapshot.totalAdmins}</TableCell>
                    <TableCell>{snapshot.snapshot.totalServices}</TableCell>
                    <TableCell className="text-right">
                      <div className="space-y-1 text-sm text-slate-200">
                        <div className="text-xs text-slate-500">{snapshot.snapshot.servicesPending} pend</div>
                        <div className="text-xs text-slate-500">{snapshot.snapshot.servicesInProgress} and</div>
                        <div className="text-xs text-slate-500">{snapshot.snapshot.servicesCompleted} comp</div>
                        <div className="text-xs text-slate-500">{snapshot.snapshot.servicesCancelled} can</div>
                      </div>
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
