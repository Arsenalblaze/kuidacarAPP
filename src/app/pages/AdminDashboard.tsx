import { useEffect, useRef, useState } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Users,
  Wrench,
  FileText,
  TrendingUp,
  DollarSign,
  Activity,
  Star,
  Percent,
  Clock,
  AlertCircle,
  Zap,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { apiClient, DEFAULT_SERVICE_CATALOG, supabase } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { AdminInternalChatPage } from "./AdminInternalChatPage";
import { PLATFORM_COMMISSION_PERCENTAGE } from "../utils/commission";

interface StatCard {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "blue" | "green" | "orange" | "red" | "purple" | "yellow";
  subtext?: string;
  details?: string;
  expanded?: boolean;
  onToggle?: () => void;
}

const SERVICE_COLOR_OPTIONS = [
  "bg-orange-500",
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-slate-500",
];

export const AdminDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [times, setTimes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adminCredentials, setAdminCredentials] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [serviceCatalog, setServiceCatalog] = useState<any[]>(DEFAULT_SERVICE_CATALOG);
  const [serviceForm, setServiceForm] = useState({
    id: "",
    name: "",
    description: "",
    price: "",
    icon: "wrench",
    estimatedTime: "30-60 min",
    color: "bg-orange-500",
  });
  const [isSavingService, setIsSavingService] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const realtimeSubscriptionRef = useRef<any>(null);
  const serviceConfigSectionRef = useRef<HTMLDivElement | null>(null);
  const serviceIconInputRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();

  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [multicaixaNumberInput, setMulticaixaNumberInput] = useState<string>('');
  const [paymentIbanInput, setPaymentIbanInput] = useState<string>('');

  useEffect(() => {
    loadStats();
    loadAdminCredentials();
    loadServiceCatalog();
    loadSystemSettings();
    setupRealtimeSubscription();

    return () => {
      if (realtimeSubscriptionRef.current) {
        supabase.removeChannel(realtimeSubscriptionRef.current);
        realtimeSubscriptionRef.current = null;
      }
    };
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);

      const [statsRes, revenueRes, timesRes] = await Promise.all([
        apiClient.getAdminDashboardStats(),
        apiClient.getRevenueStats(),
        apiClient.getAverageTimes(),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (revenueRes.success) setRevenue(revenueRes.revenue);
      if (timesRes.success) setTimes(timesRes.times);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
      toast.error("Erro ao carregar estatísticas");
    } finally {
      setLoading(false);
    }
  };

  const loadSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'system:settings')
        .maybeSingle();

      if (error) throw error;
      const value = data?.value || {};
      setSystemSettings(value);
      setMulticaixaNumberInput(value.multicaixaNumber || '929630902');
      setPaymentIbanInput(value.paymentIban || '0000 0055 3033 2012 1011 7');
    } catch (err: any) {
      console.warn('Erro ao carregar system settings:', err?.message || err);
    }
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== 'super_admin') {
      toast.error('Apenas um superadministrador pode alterar esta configuração.');
      return;
    }
    setIsSavingSettings(true);
    try {
      const value = {
        ...(systemSettings || {}),
        multicaixaNumber: multicaixaNumberInput.trim(),
        paymentIban: paymentIbanInput.trim(),
      };
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'system:settings', value })
        .select();
      if (error) throw error;
      setSystemSettings(value);
      toast.success('Configurações salvas');
    } catch (err: any) {
      console.error('Erro ao salvar system settings:', err);
      toast.error(err?.message || 'Erro ao salvar configurações');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const loadAdminCredentials = async () => {
    try {
      // Prefill form with current authenticated user's email; password fields left blank for security
      if (user) {
        setAdminCredentials({
          email: user.email || '',
          password: '',
          confirmPassword: '',
        });
      } else {
        // fallback: keep empty
        setAdminCredentials({ email: '', password: '', confirmPassword: '' });
      }
    } catch (error) {
      console.error("Erro ao carregar credenciais do usuário corrente:", error);
    }
  };

  const loadServiceCatalog = async () => {
    try {
      const response = await apiClient.getServiceCatalog();
      if (response.success && Array.isArray(response.services) && response.services.length > 0) {
        setServiceCatalog(response.services);
      } else {
        setServiceCatalog(DEFAULT_SERVICE_CATALOG);
      }
    } catch (error) {
      console.error('Erro ao carregar catálogo de serviços:', error);
      setServiceCatalog(DEFAULT_SERVICE_CATALOG);
    }
  };

  const handleServiceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingService(true);

    try {
      const richService = {
        id: serviceForm.id || serviceForm.name.trim().toLowerCase().replace(/\s+/g, '-'),
        name: serviceForm.name.trim(),
        description: serviceForm.description.trim() || serviceForm.name.trim(),
        price: Number(serviceForm.price || 0),
        icon: serviceForm.icon.trim().toLowerCase(),
        estimatedTime: serviceForm.estimatedTime.trim() || '30-60 min',
        color: serviceForm.color.trim() || 'bg-orange-500',
      };

      if (!richService.name || richService.price <= 0) {
        toast.error('Nome e preço são obrigatórios.');
        return;
      }

      const nextCatalog = [...serviceCatalog.filter((item) => item.id !== richService.id), richService];
      const response = await apiClient.saveServiceCatalog(nextCatalog);
      if (response.success) {
        setServiceCatalog(response.services);
        setServiceForm({
          id: "",
          name: "",
          description: "",
          price: "",
          icon: "wrench",
          estimatedTime: "30-60 min",
          color: "bg-orange-500",
        });
        toast.success('Serviço salvo com sucesso!');
      }
    } catch (error: any) {
      console.error('Erro ao salvar serviço:', error);
      toast.error(error.message || 'Não foi possível salvar o serviço.');
    } finally {
      setIsSavingService(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      const response = await apiClient.deleteServiceFromCatalog(serviceId);
      if (response.success) {
        setServiceCatalog(response.services);
        toast.success('Serviço removido com sucesso');
      }
    } catch (error: any) {
      console.error('Erro ao remover serviço:', error);
      toast.error(error.message || 'Não foi possível remover o serviço.');
    }
  };

  const handleServiceIconChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingIcon(true);

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const preview = typeof reader.result === 'string' ? reader.result : '';
        setServiceForm((current) => ({
          ...current,
          icon: preview,
        }));
      };
      reader.readAsDataURL(file);

      const uploadedUrl = await apiClient.uploadServiceIcon(file);
      if (uploadedUrl) {
        setServiceForm((current) => ({
          ...current,
          icon: uploadedUrl,
        }));
      }
    } catch (error: any) {
      console.error('Erro ao enviar imagem do serviço:', error);
      toast.error(error?.message || 'Não foi possível carregar a imagem do ícone.');
    } finally {
      setIsUploadingIcon(false);
      event.target.value = '';
    }
  };

  const openServiceIconPicker = () => {
    serviceIconInputRef.current?.click();
  };

  const handleAdminCredentialsSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingCredentials(true);

    if (adminCredentials.password !== adminCredentials.confirmPassword) {
      toast.error("As senhas não conferem.");
      setIsSavingCredentials(false);
      return;
    }

    try {
      // Build update payload - only include email if current user is super_admin
      const updatePayload: any = { password: adminCredentials.password };
      if (user?.role === 'super_admin') {
        updatePayload.email = adminCredentials.email;
      }

      const { error: authErr } = await supabase.auth.updateUser(updatePayload);

      if (authErr) {
        throw authErr;
      }

      // Sync current user to KV store
      try {
        await apiClient.saveCurrentUserToKvStore();
        // Also update the profiles table to keep email in sync with Auth (only if super_admin updated it)
        try {
          if (user?.id && user?.role === 'super_admin') {
            const { error: profErr } = await supabase
              .from('profiles')
              .update({ email: adminCredentials.email, updated_at: new Date().toISOString() })
              .eq('id', user.id);
            if (profErr) console.warn('⚠️ Falha ao atualizar profiles.email:', profErr.message || profErr);
          }
        } catch (innerErr) {
          console.warn('⚠️ Erro ao atualizar profiles após mudança de Auth:', innerErr);
        }
      } catch (syncErr) {
        console.warn('⚠️ Falha ao sincronizar KV store depois de atualizar credenciais:', syncErr);
      }

      toast.success("Suas credenciais foram atualizadas com sucesso!");
    } catch (error: any) {
      console.error("Erro ao atualizar credenciais de admin:", error);
      toast.error(error.message || "Não foi possível atualizar as credenciais.");
    } finally {
      setIsSavingCredentials(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (realtimeSubscriptionRef.current) {
      supabase.removeChannel(realtimeSubscriptionRef.current);
    }

    const subscription = supabase.channel("admin-dashboard");

    subscription
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_requests" },
        () => {
          loadStats();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          loadStats();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mechanic_reviews" },
        () => {
          loadStats();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_login_sessions" },
        () => {
          loadStats();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kv_store_9dc5328a", filter: "key=like.user:%" },
        () => {
          loadStats();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kv_store_9dc5328a", filter: "key=like.payment_ref:%" },
        () => {
          loadStats();
        }
      );

    subscription.subscribe();
    realtimeSubscriptionRef.current = subscription;
  };

  const StatCardComponent = (props: StatCard) => {
    const colorClasses = {
      blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
      green: "bg-green-500/10 border-green-500/20 text-green-400",
      orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
      red: "bg-red-500/10 border-red-500/20 text-red-400",
      purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
      yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    };

    const handleToggle = () => {
      if (props.onToggle) {
        props.onToggle();
        return;
      }

      setExpandedCards((current) => ({
        ...current,
        [props.title]: !current[props.title],
      }));
    };

    return (
      <Card
        className={`p-6 border ${colorClasses[props.color]} ${props.details ? "cursor-pointer transition hover:opacity-95" : ""}`}
        onClick={props.details ? handleToggle : undefined}
        role={props.details ? "button" : undefined}
        tabIndex={props.details ? 0 : undefined}
        onKeyDown={
          props.details
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleToggle();
                }
              }
            : undefined
        }
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-slate-400 text-sm font-medium">{props.title}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-white">{props.value}</h3>
              {props.subtext && (
                <span className="text-sm text-slate-400">{props.subtext}</span>
              )}
            </div>
          </div>
          <div className={`text-${props.color}-400`}>{props.icon}</div>
        </div>

        {props.details && (
          <div className="mt-4 border-t border-slate-700/80 pt-3">
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-slate-600 bg-slate-950/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              onClick={(event) => {
                event.stopPropagation();
                handleToggle();
              }}
            >
              {props.expanded ? "Ocultar detalhes" : "Mostrar detalhes"}
            </button>

            {props.expanded && (
              <p className="mt-3 text-sm text-slate-300">{props.details}</p>
            )}
          </div>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <AdminLayout title="Painel" subtitle="Visão geral da plataforma">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Zap className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-pulse" />
            <p className="text-slate-400">Carregando estatísticas...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Painel" subtitle="Visão geral em tempo real">
      <div className="space-y-6">
        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button
            onClick={loadStats}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Atualizar
          </Button>
        </div>

        <section aria-labelledby="admin-key-metrics">
          <h2 id="admin-key-metrics" className="mb-4 text-lg font-semibold text-white">Indicadores gerais e mensais</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCardComponent
              title="Total de utilizadores"
              value={stats?.totalUsers ?? 0}
              icon={<Users className="h-8 w-8" />}
              color="blue"
              details={`Inclui apenas clientes (${stats?.totalClients ?? 0}) e mecânicos (${stats?.totalMechanics ?? 0}); administradores ficam excluídos.`}
            />
            <StatCardComponent
              title="Sessões iniciadas este mês"
              value={stats?.sessionTrackingAvailable ? stats.monthlyLoginSessions : "N/D"}
              icon={<Activity className="h-8 w-8" />}
              color="purple"
              details={stats?.sessionTrackingAvailable
                ? `${stats.monthlyActiveUsers} utilizador(es) distintos iniciaram sessão este mês.`
                : "A contagem começa após executar a migração de sessões no Supabase."}
            />
            <StatCardComponent
              title="Utilização mensal"
              value={stats?.sessionTrackingAvailable ? `${stats.monthlyUserUsagePercent}%` : "N/D"}
              icon={<Percent className="h-8 w-8" />}
              color="orange"
              details="Percentagem de clientes e mecânicos únicos que iniciaram sessão neste mês, em relação ao total desses utilizadores."
            />
            <StatCardComponent
              title="Média paga por confirmação este mês"
              value={`${Number(stats?.monthlyConfirmedPaymentAverage ?? 0).toLocaleString("pt-AO")} Kz`}
              icon={<DollarSign className="h-8 w-8" />}
              color="green"
              details={`Média de ${stats?.monthlyConfirmedPaymentCount ?? 0} pagamento(s) confirmados. Total confirmado no mês: ${Number(stats?.monthlyConfirmedPaymentTotal ?? 0).toLocaleString("pt-AO")} Kz.`}
            />
            <StatCardComponent
              title="Atendimentos solicitados este mês"
              value={stats?.monthlyServiceRequests ?? 0}
              icon={<FileText className="h-8 w-8" />}
              color="yellow"
              details={`Média mensal de solicitações nos últimos 12 meses: ${stats?.averageMonthlyServiceRequests ?? 0}.`}
            />
            <StatCardComponent
              title="Avaliação média dos mecânicos"
              value={`${Number(stats?.averageMechanicRating ?? 0).toFixed(2)} / 5`}
              icon={<Star className="h-8 w-8" />}
              color="orange"
              details={`Média geral de ${stats?.mechanicReviewCount ?? 0} avaliação(ões) registadas.`}
            />
          </div>
        </section>

        <Card className="bg-slate-900/50 border-slate-700 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white">Chat interno da administração</h2>
              <p className="text-xs text-slate-400">
                Comunicação privada entre administradores.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setIsChatExpanded((prev) => !prev)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              aria-label={isChatExpanded ? "Recolher chat" : "Expandir chat"}
              title={isChatExpanded ? "Recolher" : "Expandir"}
            >
              {isChatExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>

          <div className={`overflow-hidden transition-all duration-300 ${isChatExpanded ? "max-h-[900px]" : "max-h-[0px] opacity-0"}`}>
            {isChatExpanded && <AdminInternalChatPage embedded />}
          </div>
        </Card>

        <div ref={serviceConfigSectionRef}>
          <Card className="bg-slate-900/50 border-slate-700 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-2">
                  Configuração de serviços
                </h2>
              <p className="text-sm text-slate-400">
                Adicione ou atualize os serviços exibidos para clientes e mecânicos na plataforma.
              </p>
            </div>
          </div>

          <form onSubmit={handleServiceSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-name">Nome do serviço</Label>
                <Input
                  id="service-name"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  placeholder="Ex: Diagnóstico elétrico"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-price">Preço (Kz)</Label>
                <Input
                  id="service-price"
                  type="number"
                  min="0"
                  step="100"
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                  placeholder="15000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-icon">Ícone do serviço</Label>
                <p className="text-xs text-slate-400">
                  Selecione uma imagem para representar este serviço. Pode usar um ficheiro local ou uma URL de imagem.
                </p>
                <input
                  ref={serviceIconInputRef}
                  id="service-icon-file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleServiceIconChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-orange-500 text-orange-300 hover:bg-orange-500/10"
                  onClick={openServiceIconPicker}
                  disabled={isUploadingIcon}
                >
                  {isUploadingIcon ? 'A carregar imagem...' : 'Escolher imagem'}
                </Button>
                {serviceForm.icon && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-slate-700 ${serviceForm.color || 'bg-orange-500'}`}>
                      {serviceForm.icon.startsWith('data:image') || /^https?:\/\//i.test(serviceForm.icon) ? (
                        <img
                          src={serviceForm.icon}
                          alt="Ícone do serviço"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] font-semibold uppercase text-white">{serviceForm.icon}</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">Imagem selecionada</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-time">Tempo estimado</Label>
                <Input
                  id="service-time"
                  value={serviceForm.estimatedTime}
                  onChange={(e) => setServiceForm({ ...serviceForm, estimatedTime: e.target.value })}
                  placeholder="30-60 min"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-description">Descrição</Label>
              <Input
                id="service-description"
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                placeholder="Descrição do serviço"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-color">Cor do serviço</Label>
              <div id="service-color" className="flex flex-wrap gap-2">
                {SERVICE_COLOR_OPTIONS.map((colorOption) => (
                  <button
                    key={colorOption}
                    type="button"
                    aria-label={`Selecionar cor ${colorOption}`}
                    onClick={() => setServiceForm((current) => ({ ...current, color: colorOption }))}
                    className={`h-10 w-10 rounded-full border-2 transition ${colorOption} ${
                      serviceForm.color === colorOption ? 'border-white scale-110' : 'border-slate-700 hover:border-slate-400'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isSavingService} className="bg-orange-600 hover:bg-orange-700">
                {isSavingService ? 'Salvando...' : 'Salvar serviço'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => setServiceForm({
                  id: "",
                  name: "",
                  description: "",
                  price: "",
                  icon: "wrench",
                  estimatedTime: "30-60 min",
                  color: "bg-orange-500",
                })}
              >
                Limpar
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <h3 className="text-md font-semibold text-white mb-3">Serviços atuais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {serviceCatalog.map((service) => (
                <div key={service.id} className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block h-4 w-4 rounded-full border border-slate-600 ${service.color || 'bg-orange-500'}`} />
                      <div>
                        <p className="font-medium text-white">{service.name}</p>
                        <p className="text-xs text-slate-400">{service.estimatedTime}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-orange-300">{Number(service.price || 0).toLocaleString('pt-AO')} Kz</span>
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="text-xs text-orange-300 hover:text-orange-200"
                      onClick={() => {
                        setServiceForm({
                          id: service.id,
                          name: service.name,
                          description: service.description || service.name,
                          price: String(service.price || 0),
                          icon: service.icon || 'wrench',
                          estimatedTime: service.estimatedTime || '30-60 min',
                          color: service.color || 'bg-orange-500',
                        });

                        requestAnimationFrame(() => {
                          serviceConfigSectionRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        });
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-300 hover:text-red-200"
                      onClick={() => handleDeleteService(service.id)}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
              </div>
            </div>
          </Card>
        </div>

        <Card className="bg-slate-900/50 border-slate-700 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Suas credenciais
              </h2>
              <p className="text-sm text-slate-400">
                Atualize o email e a senha da sua conta (usuário atualmente autenticado).
              </p>
            </div>
          </div>

          <form onSubmit={handleAdminCredentialsSubmit} className="mt-4 space-y-4">
            {user?.role === 'super_admin' && (
              <div className="space-y-2">
                <Label htmlFor="admin-email-settings">E-mail</Label>
                <Input
                  id="admin-email-settings"
                  type="email"
                  placeholder="e-mail"
                  value={adminCredentials.email}
                  onChange={(e) =>
                    setAdminCredentials({ ...adminCredentials, email: e.target.value })
                  }
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="admin-password-settings">Senha</Label>
              <Input
                id="admin-password-settings"
                type="password"
                placeholder="senha"
                value={adminCredentials.password}
                onChange={(e) =>
                  setAdminCredentials({ ...adminCredentials, password: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-confirm-password-settings">Confirmação de senha</Label>
              <Input
                id="admin-confirm-password-settings"
                type="password"
                placeholder="confirmação de senha"
                value={adminCredentials.confirmPassword}
                onChange={(e) =>
                  setAdminCredentials({ ...adminCredentials, confirmPassword: e.target.value })
                }
                required
              />
            </div>

            <Button type="submit" disabled={isSavingCredentials} className="bg-orange-600 hover:bg-orange-700">
              {isSavingCredentials ? "Salvando..." : "Salvar credenciais"}
            </Button>
          </form>
        </Card>

        {user?.role === 'super_admin' && (
          <Card className="bg-slate-900/50 border-slate-700 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-2">Definições do sistema</h2>
                <p className="text-sm text-slate-400">Configure valores globais da plataforma (visível e editável apenas por um superadministrador).</p>
              </div>
            </div>

            <form onSubmit={handleSaveSystemSettings} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="multicaixa-number">Número Multicaixa Express</Label>
                <Input
                  id="multicaixa-number"
                  value={multicaixaNumberInput}
                  onChange={(e) => setMulticaixaNumberInput(e.target.value)}
                  placeholder="929630902"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-dashboard-payment-iban">IBAN</Label>
                <Input
                  id="admin-dashboard-payment-iban"
                  value={paymentIbanInput}
                  onChange={(e) => setPaymentIbanInput(e.target.value)}
                  placeholder="0000 0055 3033 2012 1011 7"
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isSavingSettings} className="bg-orange-600 hover:bg-orange-700">
                  {isSavingSettings ? 'Salvando...' : 'Salvar dados de pagamento'}
                </Button>
                <Button type="button" variant="outline" onClick={loadSystemSettings} className="border-slate-700 text-slate-300">
                  Recarregar
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Clientes Section */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Clientes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCardComponent
              title="Total de Clientes"
              value={stats?.totalClients || 0}
              icon={<Users className="w-8 h-8" />}
              color="blue"
              details="Total de clientes cadastrados na plataforma até o momento."
              expanded={!!expandedCards["Total de Clientes"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Total de Clientes": !current["Total de Clientes"],
                }))
              }
            />
            <StatCardComponent
              title="Clientes conectados"
              value={stats?.clientsOnline ?? "N/D"}
              icon={<Zap className="w-8 h-8" />}
              color="green"
              details="Clientes atualmente conectados e ativos no sistema."
              expanded={!!expandedCards["Clientes conectados"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Clientes conectados": !current["Clientes conectados"],
                }))
              }
            />
            <StatCardComponent
              title="Clientes Bloqueados"
              value={stats?.blockedClients || 0}
              icon={<AlertCircle className="w-8 h-8" />}
              color="red"
              details="Quantidade de clientes com acesso bloqueado pela administração."
              expanded={!!expandedCards["Clientes Bloqueados"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Clientes Bloqueados": !current["Clientes Bloqueados"],
                }))
              }
            />
          </div>
        </div>

        {/* Mecânicos Section */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-purple-400" />
            Mecânicos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCardComponent
              title="Total de Mecânicos"
              value={stats?.totalMechanics || 0}
              icon={<Wrench className="w-8 h-8" />}
              color="purple"
              details="Número total de prestadores cadastrados no sistema."
              expanded={!!expandedCards["Total de Mecânicos"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Total de Mecânicos": !current["Total de Mecânicos"],
                }))
              }
            />
            <StatCardComponent
              title="Disponíveis"
              value={stats?.availableMechanics || 0}
              icon={<Zap className="w-8 h-8" />}
              color="green"
              details="Prestadores prontos para receber novas solicitações."
              expanded={!!expandedCards["Disponíveis"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Disponíveis": !current["Disponíveis"],
                }))
              }
            />
            <StatCardComponent
              title="Ocupados"
              value={stats?.busyMechanics || 0}
              icon={<Clock className="w-8 h-8" />}
              color="yellow"
              details="Prestadores que já estão atendendo uma solicitação."
              expanded={!!expandedCards["Ocupados"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Ocupados": !current["Ocupados"],
                }))
              }
            />
            <StatCardComponent
              title="Desconectados"
              value={stats?.offlineMechanics || 0}
              icon={<AlertCircle className="w-8 h-8" />}
              color="red"
              details="Prestadores fora do sistema ou sem disponibilidade no momento."
              expanded={!!expandedCards["Desconectados"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Desconectados": !current["Desconectados"],
                }))
              }
            />
          </div>
        </div>

        {/* Solicitações Section */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-400" />
            Solicitações
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <StatCardComponent
              title="Hoje"
              value={stats?.requestsToday || 0}
              icon={<FileText className="w-8 h-8" />}
              color="blue"
              details="Solicitações criadas no dia atual."
              expanded={!!expandedCards["Hoje"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  Hoje: !current["Hoje"],
                }))
              }
            />
            <StatCardComponent
              title="Em Andamento"
              value={stats?.requestsInProgress || 0}
              icon={<Clock className="w-8 h-8" />}
              color="yellow"
              details="Solicitações já aceitas e ainda em atendimento."
              expanded={!!expandedCards["Em Andamento"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Em Andamento": !current["Em Andamento"],
                }))
              }
            />
            <StatCardComponent
              title="Concluídas"
              value={stats?.requestsCompleted || 0}
              icon={<Zap className="w-8 h-8" />}
              color="green"
              details="Solicitações finalizadas com sucesso."
              expanded={!!expandedCards["Concluídas"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Concluídas": !current["Concluídas"],
                }))
              }
            />
            <StatCardComponent
              title="Canceladas"
              value={stats?.requestsCancelled || 0}
              icon={<AlertCircle className="w-8 h-8" />}
              color="red"
              details="Solicitações canceladas por cliente, prestador ou sistema."
              expanded={!!expandedCards["Canceladas"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Canceladas": !current["Canceladas"],
                }))
              }
            />
            <StatCardComponent
              title="Recusadas"
              value={stats?.requestsRefused || 0}
              icon={<AlertCircle className="w-8 h-8" />}
              color="red"
              details="Solicitações rejeitadas ou não aceitas pelos prestadores."
              expanded={!!expandedCards["Recusadas"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Recusadas": !current["Recusadas"],
                }))
              }
            />
          </div>
        </div>

        {/* Financeiro Section */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Financeiro
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCardComponent
              title="Receita Total"
              value={`AOA ${(revenue?.totalRevenue || 0).toFixed(2)}`}
              icon={<TrendingUp className="w-8 h-8" />}
              color="green"
              subtext={`${PLATFORM_COMMISSION_PERCENTAGE}% = comissão`}
              details="Valor bruto gerado por todas as solicitações e serviços registrados."
              expanded={!!expandedCards["Receita Total"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Receita Total": !current["Receita Total"],
                }))
              }
            />
            <StatCardComponent
              title="Comissão Total"
              value={`AOA ${(revenue?.totalCommission || 0).toFixed(2)}`}
              icon={<DollarSign className="w-8 h-8" />}
              color="blue"
              details="Comissão acumulada sobre as solicitações processadas."
              expanded={!!expandedCards["Comissão Total"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Comissão Total": !current["Comissão Total"],
                }))
              }
            />
            <StatCardComponent
              title="Receita Hoje"
              value={`AOA ${(revenue?.todayRevenue || 0).toFixed(2)}`}
              icon={<TrendingUp className="w-8 h-8" />}
              color="green"
              details="Receita gerada nas solicitações do dia atual."
              expanded={!!expandedCards["Receita Hoje"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Receita Hoje": !current["Receita Hoje"],
                }))
              }
            />
            <StatCardComponent
              title="Comissão Pendente"
              value={`AOA 0.00`}
              icon={<Clock className="w-8 h-8" />}
              color="yellow"
              details="Valor ainda pendente de liquidação ou repasse."
              expanded={!!expandedCards["Comissão Pendente"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Comissão Pendente": !current["Comissão Pendente"],
                }))
              }
            />
          </div>
        </div>

        {/* Tempo Médio Section */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Tempo Médio
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCardComponent
              title="Tempo Médio de Atendimento"
              value={`${times?.avgResponseTime || 0} min`}
              icon={<Clock className="w-8 h-8" />}
              color="blue"
              details="Tempo médio até a primeira resposta ou aceitação do pedido."
              expanded={!!expandedCards["Tempo Médio de Atendimento"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Tempo Médio de Atendimento": !current["Tempo Médio de Atendimento"],
                }))
              }
            />
            <StatCardComponent
              title="Tempo Médio de Conclusão"
              value={`${times?.avgCompletionTime || 0} min`}
              icon={<TrendingUp className="w-8 h-8" />}
              color="green"
              details="Tempo médio para a conclusão total do serviço."
              expanded={!!expandedCards["Tempo Médio de Conclusão"]}
              onToggle={() =>
                setExpandedCards((current) => ({
                  ...current,
                  "Tempo Médio de Conclusão": !current["Tempo Médio de Conclusão"],
                }))
              }
            />
          </div>
        </div>

        {/* Info Box */}
        <Card className="bg-slate-900/50 border-slate-700 p-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white font-medium">Dados em Tempo Real</p>
              <p className="text-slate-400 text-sm">
                As estatísticas são atualizadas automaticamente quando há mudanças nos dados.
                Clique em "Atualizar" para forçar uma atualização manual.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};
