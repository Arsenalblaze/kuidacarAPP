import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { Card } from "../components/ui/card";
import { Settings, BarChart3, FileText, Download, Printer, CalendarRange, Database, Archive, Trash2, ShieldAlert, UserX } from "lucide-react";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { apiClient, supabase } from "../utils/api";
import { recordAdminAuditEvent } from "../utils/adminAudit";
import { calculatePlatformCommission, PLATFORM_COMMISSION_PERCENTAGE } from "../utils/commission";
import { toast } from "sonner";

type ReportType =
  | "general"
  | "users"
  | "mechanics"
  | "clients"
  | "services"
  | "financial"
  | "debts"
  | "reviews"
  | "cancellations"
  | "admin_activity";

type PeriodType = "today" | "7days" | "30days" | "thisMonth" | "previousMonth" | "custom";

const reportTypeOptions: { value: ReportType; label: string }[] = [
  { value: "general", label: "Relatório geral da plataforma" },
  { value: "users", label: "Usuários" },
  { value: "mechanics", label: "Mecânicos" },
  { value: "clients", label: "Clientes" },
  { value: "services", label: "Serviços / corridas" },
  { value: "financial", label: "Financeiro" },
  { value: "debts", label: "Dívidas" },
  { value: "reviews", label: "Avaliações" },
  { value: "cancellations", label: "Cancelamentos" },
  { value: "admin_activity", label: "Atividades administrativas" },
];

const periodOptions: { value: PeriodType; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7days", label: "Últimos 7 dias" },
  { value: "30days", label: "Últimos 30 dias" },
  { value: "thisMonth", label: "Este mês" },
  { value: "previousMonth", label: "Mês anterior" },
  { value: "custom", label: "Personalizado" },
];

const adminAuditActionLabels: Record<string, string> = {
  "supervision.assignment": "Alteração de supervisão",
  "settings.update": "Alteração de configurações",
  "admin.create": "Criação de administrador",
  "admin.role.change": "Alteração de perfil de acesso",
  "profile.access.change": "Alteração de estado/permissões",
  "user.delete": "Eliminação de utilizador",
  "data.archive": "Arquivamento de dados",
  "data.delete": "Eliminação de dados",
  "report.generate": "Geração de relatório",
  "service_request.insert": "Criação de solicitação",
  "service_request.update": "Alteração/aprovação de solicitação",
  "service_request.delete": "Eliminação de solicitação",
};

const formatMoney = (value: number) =>
  `${Number(value || 0).toLocaleString("pt-AO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} Kz`;

const escapeHtml = (value: unknown) => {
  const escapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(value ?? "").replace(/[&<>"']/g, (character) => escapes[character] || character);
};

const safeNumber = (value: any) => Number(value || 0);

const toDateInputValue = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

export const AdminSettingsPage = () => {
  const { user } = useAuth();
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [multicaixaNumberInput, setMulticaixaNumberInput] = useState<string>("");
  const [paymentIbanInput, setPaymentIbanInput] = useState<string>("");
  const [supportContactNameInput, setSupportContactNameInput] = useState<string>("");
  const [supportContactPhoneInput, setSupportContactPhoneInput] = useState<string>("");
  const [providerTermsInput, setProviderTermsInput] = useState<string>("");
  const [customerTermsInput, setCustomerTermsInput] = useState<string>("");
  const [privacyNoticeInput, setPrivacyNoticeInput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminCreating, setAdminCreating] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmailRole, setAdminEmailRole] = useState("");
  const [adminPasswordRole, setAdminPasswordRole] = useState("");
  const [adminCreatingRole, setAdminCreatingRole] = useState(false);
  const [adminNameRole, setAdminNameRole] = useState("");
  const [userToDeleteId, setUserToDeleteId] = useState("");
  const [deletingUser, setDeletingUser] = useState(false);

  const [reportType, setReportType] = useState<ReportType>("general");
  const [reportPeriod, setReportPeriod] = useState<PeriodType>("30days");
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return toDateInputValue(date);
  });
  const [customTo, setCustomTo] = useState<string>(() => toDateInputValue(new Date()));
  const [selectedMechanic, setSelectedMechanic] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [serviceStatus, setServiceStatus] = useState<string>("all");
  const [serviceType, setServiceType] = useState<string>("all");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDataError, setReportDataError] = useState("");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reportPreview, setReportPreview] = useState<Record<string, string | number>>({});
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [cleanupStats, setCleanupStats] = useState({
    databaseUsed: 0,
    archivedData: 0,
    removableData: 0,
    isAboveLimit: false,
  });
  const [cleanupConfig, setCleanupConfig] = useState({
    oldRequests: "6months",
    oldNotifications: "90days",
    oldMessages: "12months",
    oldLocations: "30days",
    financialHistory: "keep",
  });
  const [cleanupConfirmText, setCleanupConfirmText] = useState("");
  const [supervisionHistory, setSupervisionHistory] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState<string>("");
  const [adminAuditHistory, setAdminAuditHistory] = useState<any[]>([]);
  const [auditHistoryError, setAuditHistoryError] = useState("");

  const recordAuditEvent = async (event: Omit<
    Parameters<typeof recordAdminAuditEvent>[0],
    "actorId" | "actorName" | "actorEmail" | "actorRole"
  >) => {
    if (!user?.id) {
      toast.warning("A ação foi realizada, mas não foi possível identificar o administrador para a auditoria.");
      return false;
    }

    try {
      await recordAdminAuditEvent({
        ...event,
        actorId: user.id,
        actorName: user.name || user.email || "Administrador",
        actorEmail: user.email || "",
        actorRole: user.role || "admin",
      });
      return true;
    } catch (error: any) {
      console.error("Erro ao registrar auditoria administrativa:", error);
      toast.warning("A ação foi realizada, mas não foi possível guardá-la na auditoria. Verifique a migração de auditoria no Supabase.");
      return false;
    }
  };

  const loadSystemSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "system:settings")
        .maybeSingle();

      if (error) throw error;
      const value = data?.value || {};
      setSystemSettings(value);
      setMulticaixaNumberInput(value.multicaixaNumber || "929630902");
      setPaymentIbanInput(value.paymentIban || "0000 0055 3033 2012 1011 7");
      setSupportContactNameInput(value.supportContactName || "");
      setSupportContactPhoneInput(value.supportContactPhone || "");
      setProviderTermsInput(value.providerTerms || "");
      setCustomerTermsInput(value.customerTerms || "");
      setPrivacyNoticeInput(value.privacyNotice || "");
    } catch (err: any) {
      console.warn("Erro ao carregar system settings:", err?.message || err);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const loadReportData = async () => {
    try {
      setReportLoading(true);

      const loadAllRows = async (table: "profiles" | "service_requests" | "mechanic_reviews") => {
        const rows: any[] = [];
        let offset = 0;
        const pageSize = 1000;

        while (true) {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .order("id", { ascending: true })
            .range(offset, offset + pageSize - 1);
          if (error) throw error;

          const page = data || [];
          rows.push(...page);
          if (page.length < pageSize) return rows;
          offset += pageSize;
        }
      };

      const [profileRows, serviceRows, reviewRows] = await Promise.all([
        loadAllRows("profiles"),
        loadAllRows("service_requests"),
        loadAllRows("mechanic_reviews"),
      ]);

      setProfiles(profileRows);
      setServices(serviceRows);
      setReviews(reviewRows);
      setReportDataError("");
    } catch (err: any) {
      console.error("Erro ao carregar dados do relatório:", err);
      setReportDataError(err?.message || "Não foi possível carregar os dados do relatório.");
      toast.error(err?.message || "Não foi possível carregar os dados do relatório.");
    } finally {
      setReportLoading(false);
    }
  };

  const getDateRange = (mode: PeriodType) => {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    if (mode === "today") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    if (mode === "7days") {
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    if (mode === "30days") {
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    if (mode === "thisMonth") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }

    if (mode === "previousMonth") {
      start.setMonth(now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
    }

    if (mode === "custom") {
      const from = new Date(`${customFrom || toDateInputValue(now)}T00:00:00`);
      const to = new Date(`${customTo || toDateInputValue(now)}T00:00:00`);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      return { start: from, end: to };
    }

    return { start, end };
  };

  const matchesDateWindow = (dateValue: string | null | undefined, mode: PeriodType) => {
    if (!dateValue) return false;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;
    const { start, end } = getDateRange(mode);
    return date >= start && date <= end;
  };

  const reportMetrics = useMemo(() => {
    const { start, end } = getDateRange(reportPeriod);
    const filteredReviews = reviews.filter((review: any) =>
      matchesDateWindow(review.created_at || review.createdAt, reportPeriod)
    );
    const filteredAuditHistory = adminAuditHistory.filter((event: any) =>
      matchesDateWindow(event.created_at, reportPeriod)
    );

    let filteredServices = services.filter((item: any) => {
      const date = item.created_at || item.createdAt || item.date;
      if (!date || !matchesDateWindow(date, reportPeriod)) return false;

      if (selectedMechanic !== "all") {
        const mechanicId = item.provider_id || item.mechanic_id || item.mechanicId || item.providerId;
        if (String(mechanicId) !== String(selectedMechanic)) return false;
      }

      if (selectedCustomer !== "all") {
        const customerId = item.customer_id || item.customerId || item.user_id || item.userId;
        if (String(customerId) !== String(selectedCustomer)) return false;
      }

      if (serviceStatus !== "all") {
        const status = String(item.status || "").toLowerCase();
        if (status !== String(serviceStatus).toLowerCase()) return false;
      }

      if (serviceType !== "all") {
        const type = String(item.service_type || item.type || item.serviceType || "").toLowerCase();
        if (type !== String(serviceType).toLowerCase()) return false;
      }

      if (paymentMethod !== "all") {
        const method = String(item.payment_method || item.paymentMethod || "").toLowerCase();
        if (method !== String(paymentMethod).toLowerCase()) return false;
      }

      return true;
    });

    const totalCustomers = profiles.filter((user: any) => {
      const role = String(user.role || user.user_role || "").toLowerCase();
      return role === "customer";
    }).length;

    const totalMechanics = profiles.filter((user: any) => {
      const role = String(user.role || user.user_role || "").toLowerCase();
      return role === "provider" || role === "mechanic";
    }).length;

    const totalUsers = profiles.length;
    const activeUsers = profiles.filter((user: any) => {
      const isOnline = Boolean(user.is_online ?? user.isOnline ?? user.online);
      const isActive = Boolean(user.is_active ?? user.isActive ?? true);
      return isOnline || isActive;
    }).length;

    const blockedUsers = profiles.filter((user: any) => Boolean(user.is_blocked ?? user.isBlocked)).length;
    const newUsers = profiles.filter((user: any) => {
      const date = user.created_at || user.createdAt;
      return !!date && new Date(date) >= start && new Date(date) <= end;
    }).length;

    const totalServices = filteredServices.length;
    const servicesCompleted = filteredServices.filter((item: any) => String(item.status || "").toLowerCase() === "completed").length;
    const cancelledServiceRows = filteredServices.filter((item: any) =>
      ["cancelled", "canceled", "cancelada", "cancelado", "rejected", "declined"].includes(String(item.status || "").toLowerCase())
    );
    const servicesCancelled = cancelledServiceRows.length;
    const cancellationCounts = cancelledServiceRows.reduce((counts, item: any) => {
      const actor = String(item.cancelled_by_role || item.canceled_by_role || item.cancellation_actor_role || item.cancelled_by || item.canceled_by || "").toLowerCase();
      const actorId = String(item.cancelled_by_id || item.canceled_by_id || item.cancellation_user_id || "");
      const customerId = String(item.customer_id || item.customerId || item.user_id || item.userId || "");
      const mechanicId = String(item.provider_id || item.mechanic_id || item.mechanicId || item.providerId || "");

      if (actor.includes("customer") || actor.includes("client") || actor.includes("cliente") || (actorId && actorId === customerId)) {
        counts.customer += 1;
      } else if (actor.includes("provider") || actor.includes("mechanic") || actor.includes("mecânico") || (actorId && actorId === mechanicId)) {
        counts.mechanic += 1;
      } else {
        counts.unknown += 1;
      }

      return counts;
    }, { customer: 0, mechanic: 0, unknown: 0 });
    const servicesInProgress = filteredServices.filter((item: any) => ["pending", "accepted", "in_progress", "in progress"].includes(String(item.status || "").toLowerCase())).length;

    const revenueTotal = filteredServices.reduce((sum, item) => sum + safeNumber(item.final_price ?? item.price ?? item.total_price), 0);
    const getServiceCommission = (item: any) => calculatePlatformCommission(
      safeNumber(item.final_price ?? item.price ?? item.total_price),
      item.finalized_at || item.finalizedAt || item.completed_at || item.completedAt || item.created_at || item.createdAt,
    );
    const debtByRequest = filteredServices.reduce((sum, item) => sum + getServiceCommission(item), 0);
    const averageMonthlyDebt = totalServices > 0 ? debtByRequest / totalServices : 0;
    const kuidaCommission = filteredServices.reduce((sum, item) => {
      const amount = safeNumber(item.final_price ?? item.price ?? item.total_price);
      return sum + safeNumber(item.commission ?? item.kuida_commission ?? item.platform_fee ?? getServiceCommission(item));
    }, 0);
    const providerPay = filteredServices.reduce((sum, item) => {
      const amount = safeNumber(item.final_price ?? item.price ?? item.total_price);
      const commission = safeNumber(item.commission ?? item.kuida_commission ?? item.platform_fee ?? getServiceCommission(item));
      return sum + safeNumber(item.provider_amount ?? item.mechanic_amount ?? item.providerPay ?? (amount - commission));
    }, 0);
    const openDebt = profiles.reduce((sum, user: any) => sum + safeNumber(user.debt ?? user.debt_amount), 0);
    const paidDebt = profiles.filter((user: any) => safeNumber(user.debt ?? user.debt_amount) <= 0).length;
    const pendingDebt = profiles.filter((user: any) => safeNumber(user.debt ?? user.debt_amount) > 0).length;

    const ratingsAverage = filteredReviews.length > 0
      ? filteredReviews.reduce((sum, review: any) => sum + safeNumber(review.rating), 0) / filteredReviews.length
      : 0;

    const totalReviews = filteredReviews.length;
    const supervisionActions = filteredAuditHistory.filter((event: any) => String(event.action || "").startsWith("supervision."));
    const reportActions = filteredAuditHistory.filter((event: any) => event.action === "report.generate");
    const uniqueAdmins = new Set(filteredAuditHistory.map((event: any) => event.actor_id || event.actor_email || event.actor_name).filter(Boolean));
    const adminActivityRows = filteredAuditHistory.map((event: any) => ({
      id: event.id,
      admin: event.actor_name || profiles.find((profile: any) => profile.id === event.actor_id)?.name || event.actor_email || "Administrador",
      ação: adminAuditActionLabels[event.action] || event.action,
      alvo: event.entity_id || "--",
      detalhes: event.description,
      data: event.created_at,
    }));

    const rows = filteredServices.map((item: any) => ({
      id: item.id || item.service_id || "--",
      cliente: item.customer_name || item.customerName || item.customer_id || "Cliente",
      mecanico: item.provider_name || item.mechanic_name || item.mechanicName || item.provider_id || "Prestador",
      data: item.created_at || item.createdAt || item.date || "--",
      status: item.status || "--",
      valor: safeNumber(item.final_price ?? item.price ?? item.total_price),
    }));
    const cancellationRows = rows.filter((row) =>
      ["cancelled", "canceled", "cancelada", "cancelado", "rejected", "declined"].includes(String(row.status).toLowerCase())
    );
    const debtRows = profiles
      .filter((profile: any) => safeNumber(profile.debt ?? profile.debt_amount) > 0)
      .map((profile: any) => ({
        id: profile.id || "--",
        prestador: profile.name || profile.email || "Prestador",
        email: profile.email || "--",
        valor: safeNumber(profile.debt ?? profile.debt_amount),
      }));
    const userRows = profiles
      .filter((profile: any) => matchesDateWindow(profile.created_at || profile.createdAt, reportPeriod))
      .map((profile: any) => ({
        id: profile.id || "--",
        nome: profile.name || profile.email || "Utilizador",
        email: profile.email || "--",
        tipo: profile.role || profile.user_role || "--",
        data: profile.created_at || profile.createdAt || "--",
        estado: profile.is_blocked || profile.isBlocked ? "Bloqueado" : "Ativo",
      }));
    const reviewRows = filteredReviews.map((review: any) => ({
      id: review.id || "--",
      cliente: review.customer_name || review.customer_id || "Cliente",
      mecânico: review.mechanic_name || review.mechanic_id || "Mecânico",
      classificação: `${safeNumber(review.rating)}/5`,
      comentário: review.comment || "--",
      data: review.created_at || review.createdAt || "--",
    }));

    return {
      totalCustomers,
      totalMechanics,
      totalUsers,
      activeUsers,
      blockedUsers,
      newUsers,
      totalServices,
      servicesCompleted,
      servicesCancelled,
      cancellationByCustomer: cancellationCounts.customer,
      cancellationByMechanic: cancellationCounts.mechanic,
      cancellationUnknown: cancellationCounts.unknown,
      servicesInProgress,
      revenueTotal,
      averageMonthlyDebt,
      kuidaCommission,
      providerPay,
      openDebt,
      paidDebt,
      pendingDebt,
      ratingsAverage,
      totalReviews,
      adminActivityCount: filteredAuditHistory.length,
      supervisionActionCount: supervisionActions.length,
      reportActionCount: reportActions.length,
      activeAdminCount: uniqueAdmins.size,
      adminActivityRows,
      cancellationRows,
      debtRows,
      userRows,
      reviewRows,
      rows,
    };
  }, [profiles, services, reviews, adminAuditHistory, reportType, reportPeriod, customFrom, customTo, selectedMechanic, selectedCustomer, serviceStatus, serviceType, paymentMethod]);

  const loadSupervisionHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("user_supervision_assignments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error && !String(error.message || "").toLowerCase().includes("does not exist")) {
        throw error;
      }

      setSupervisionHistory((data || []).map((item: any) => ({
        ...item,
        dateLabel: new Date(item.created_at || Date.now()).toLocaleDateString("pt-BR"),
      })));
    } catch (error: any) {
      console.warn("Histórico de supervisão indisponível:", error?.message || error);
      setSupervisionHistory([]);
    }
  };

  const loadAdminAuditHistory = async () => {
    try {
      const rows: any[] = [];
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("admin_audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;

        const page = data || [];
        rows.push(...page);
        if (page.length < pageSize) break;
        offset += pageSize;
      }

      setAdminAuditHistory(rows);
      setAuditHistoryError("");
    } catch (error: any) {
      console.error("Erro ao carregar auditoria administrativa:", error);
      setAdminAuditHistory([]);
      setAuditHistoryError("Não foi possível carregar a auditoria. Confirme se a migração admin_audit_logs foi executada no Supabase.");
    }
  };

  useEffect(() => {
    loadSystemSettings();
    loadReportData();
    loadSupervisionHistory();
    loadAdminAuditHistory();

    try {
      const existingReports = JSON.parse(localStorage.getItem("kuidacar_reports") || "[]");
      setSavedReports(Array.isArray(existingReports) ? existingReports : []);
    } catch (error) {
      console.warn("Não foi possível carregar relatórios salvos:", error);
      setSavedReports([]);
    }
  }, []);

  useEffect(() => {
    const metrics = reportMetrics;

    const byType: Record<ReportType, Record<string, string | number>> = {
      general: {
        "Total de clientes cadastrados": metrics.totalCustomers,
        "Total de mecânicos/prestadores cadastrados": metrics.totalMechanics,
        "Novos usuários no período": metrics.newUsers,
        "Usuários ativos": metrics.activeUsers,
        "Usuários bloqueados": metrics.blockedUsers,
        "Total de serviços solicitados": metrics.totalServices,
        "Serviços concluídos": metrics.servicesCompleted,
        "Serviços cancelados": metrics.servicesCancelled,
        "Serviços em andamento": metrics.servicesInProgress,
        "Valor total dos serviços": formatMoney(metrics.revenueTotal),
        "Média mensal de dívida por solicitação": formatMoney(metrics.averageMonthlyDebt),
        "Comissão total da KuidaCar": formatMoney(metrics.kuidaCommission),
        "Dívidas acumuladas dos prestadores": formatMoney(metrics.openDebt),
        "Dívidas pagas": metrics.paidDebt,
        "Dívidas pendentes": metrics.pendingDebt,
      },
      users: {
        "Total de usuários": metrics.totalUsers,
        "Usuários ativos": metrics.activeUsers,
        "Usuários bloqueados": metrics.blockedUsers,
        "Novos usuários": metrics.newUsers,
      },
      mechanics: {
        "Total de mecânicos": metrics.totalMechanics,
        "Serviços recebidos": metrics.totalServices,
        "Serviços concluídos": metrics.servicesCompleted,
        "Serviços cancelados": metrics.servicesCancelled,
        "Valor total dos serviços": formatMoney(metrics.revenueTotal),
        "Comissão da KuidaCar": formatMoney(metrics.kuidaCommission),
        "Dívida atual": formatMoney(metrics.openDebt),
        "Avaliação média": metrics.ratingsAverage ? `${metrics.ratingsAverage.toFixed(1)}/5` : "0.0/5",
        "Número de avaliações": metrics.totalReviews,
      },
      clients: {
        "Total de clientes": metrics.totalCustomers,
        "Clientes ativos": metrics.activeUsers,
        "Clientes bloqueados": metrics.blockedUsers,
        "Solicitações no período": metrics.totalServices,
        "Serviços concluídos": metrics.servicesCompleted,
        "Serviços cancelados": metrics.servicesCancelled,
        "Valor total gasto": formatMoney(metrics.revenueTotal),
      },
      services: {
        "Total de serviços": metrics.totalServices,
        "Em andamento": metrics.servicesInProgress,
        "Concluídos": metrics.servicesCompleted,
        "Cancelados": metrics.servicesCancelled,
        "Receita total": formatMoney(metrics.revenueTotal),
        "Comissão da KuidaCar": formatMoney(metrics.kuidaCommission),
      },
      financial: {
        "Receita bruta": formatMoney(metrics.revenueTotal),
        "Média mensal de dívida por solicitação": formatMoney(metrics.averageMonthlyDebt),
        "Comissão da KuidaCar": formatMoney(metrics.kuidaCommission),
        "Valor destinado aos mecânicos": formatMoney(metrics.providerPay),
        "Total de dívidas": formatMoney(metrics.openDebt),
        "Dívidas pagas": metrics.paidDebt,
        "Dívidas pendentes": metrics.pendingDebt,
        "Total de pagamentos": metrics.totalServices,
      },
      debts: {
        "Dívida total atual": formatMoney(metrics.openDebt),
        "Média mensal de dívida por solicitação": formatMoney(metrics.averageMonthlyDebt),
        "Dívidas pagas": metrics.paidDebt,
        "Dívidas pendentes": metrics.pendingDebt,
        "Total de prestadores com dívida": metrics.pendingDebt,
      },
      reviews: {
        "Média geral da plataforma": metrics.ratingsAverage ? `${metrics.ratingsAverage.toFixed(1)}/5` : "0.0/5",
        "Número de avaliações": metrics.totalReviews,
      },
      cancellations: {
        "Total de cancelamentos": metrics.servicesCancelled,
        "Cancelamentos por clientes": metrics.cancellationByCustomer,
        "Cancelamentos por mecânicos": metrics.cancellationByMechanic,
        "Responsável não identificado": metrics.cancellationUnknown,
        "Percentagem de cancelamento": metrics.totalServices > 0 ? `${((metrics.servicesCancelled / metrics.totalServices) * 100).toFixed(1)}%` : "0%",
      },
      admin_activity: {
        "Ações administrativas": metrics.adminActivityCount,
        "Administradores ativos no período": metrics.activeAdminCount,
        "Alterações de supervisão/acesso": metrics.supervisionActionCount,
        "Relatórios gerados": metrics.reportActionCount,
      },
    };
    const { start, end } = getDateRange(reportPeriod);
    const appliedFilters = [
      selectedMechanic !== "all" ? `Mecânico: ${mechanicOptions.find((item) => item.id === selectedMechanic)?.name || selectedMechanic}` : "",
      selectedCustomer !== "all" ? `Cliente: ${customerOptions.find((item) => item.id === selectedCustomer)?.name || selectedCustomer}` : "",
      serviceStatus !== "all" ? `Estado: ${serviceStatus}` : "",
      serviceType !== "all" ? `Tipo: ${serviceType}` : "",
      paymentMethod !== "all" ? `Pagamento: ${paymentMethod}` : "",
    ].filter(Boolean);
    const reportSummary = {
      "Período analisado": periodOptions.find((item) => item.value === reportPeriod)?.label || reportPeriod,
      "Data inicial": start.toLocaleDateString("pt-BR"),
      "Data final": end.toLocaleDateString("pt-BR"),
      "Filtros adicionais": appliedFilters.join(" · ") || "Nenhum",
      ...byType[reportType],
    };

    const detailRows = (() => {
      if (reportType === "users") {
        return metrics.userRows.slice(0, 100);
      }

      if (reportType === "mechanics") {
        return metrics.userRows
          .filter((row: any) => ["provider", "mechanic"].includes(String(row.tipo).toLowerCase()))
          .slice(0, 100);
      }

      if (reportType === "clients") {
        return metrics.userRows
          .filter((row: any) => String(row.tipo).toLowerCase() === "customer")
          .slice(0, 100);
      }

      if (reportType === "reviews") {
        return metrics.reviewRows.slice(0, 100);
      }

      if (reportType === "debts") {
        return metrics.debtRows.slice(0, 100);
      }

      if (reportType === "cancellations") {
        return metrics.cancellationRows.slice(0, 100);
      }

      if (reportType === "admin_activity") {
        return metrics.adminActivityRows.slice(0, 100);
      }

      return metrics.rows.slice(0, 100);
    })();

    setReportPreview(reportSummary);
    setReportRows(detailRows);
  }, [reportMetrics, reportType]);

  const handleGenerateReport = async () => {
    if (reportLoading) return;
    if (reportDataError) {
      toast.error("Não foi possível gerar o relatório porque os dados não foram carregados.");
      return;
    }
    if (reportType === "admin_activity" && auditHistoryError) {
      toast.error("Não foi possível gerar o relatório porque o histórico de auditoria não está disponível.");
      return;
    }
    if (reportPeriod === "custom") {
      const start = new Date(`${customFrom}T00:00:00`);
      const end = new Date(`${customTo}T00:00:00`);
      if (!customFrom || !customTo || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        toast.error("Informe um intervalo personalizado válido, com a data inicial anterior ou igual à final.");
        return;
      }
    }
    setReportGenerated(true);
    const auditRecorded = await recordAuditEvent({
      action: "report.generate",
      entityType: "report",
      description: `Gerou o relatório "${reportTypeOptions.find((item) => item.value === reportType)?.label || reportType}".`,
      details: {
        type: reportType,
        period: reportPeriod,
        from: reportPeriod === "custom" ? customFrom : null,
        to: reportPeriod === "custom" ? customTo : null,
        mechanicId: selectedMechanic,
        customerId: selectedCustomer,
        serviceStatus,
        serviceType,
        paymentMethod,
      },
    });
    if (auditRecorded) await loadAdminAuditHistory();
    toast.success("Relatório gerado com sucesso.");
  };

  const handleExportCsv = () => {
    if (!reportGenerated || !Object.keys(reportPreview).length) {
      toast.error("Gere primeiro o relatório para exportar.");
      return false;
    }

    const rows = [
      ["Campo", "Valor"],
      ...Object.entries(reportPreview).map(([key, value]) => [key, String(value)]),
    ];
    if (reportRows.length) {
      const columns = Object.keys(reportRows[0]);
      rows.push([]);
      rows.push(columns);
      reportRows.forEach((row) => rows.push(columns.map((column) => String(row[column] ?? ""))));
    }

    const content = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-${reportType}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  };

  const handleExportExcel = () => {
    if (handleExportCsv()) {
      toast.info("Arquivo CSV preparado para importação em Excel.");
    }
  };

  const handleExportPdf = () => {
    if (!reportGenerated || !Object.keys(reportPreview).length) {
      toast.error("Gere primeiro o relatório para exportar em PDF.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast.error("O navegador bloqueou a abertura da janela de impressão.");
      return;
    }

    const rowsHtml = Object.entries(reportPreview)
      .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
      .join("");
    const detailColumns = reportRows.length ? Object.keys(reportRows[0]) : [];
    const detailHeadersHtml = detailColumns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
    const detailRowsHtml = reportRows.map((row) =>
      `<tr>${detailColumns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join("")}</tr>`
    ).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório KuidaCar</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
            h1 { margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            td { border: 1px solid #d1d5db; padding: 10px 12px; }
            th { background: #f3f4f6; border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; }
            .meta { color: #4b5563; margin-bottom: 18px; }
          </style>
        </head>
        <body>
          <h1>Relatório KuidaCar</h1>
          <div class="meta">Tipo: ${escapeHtml(reportTypeOptions.find((item) => item.value === reportType)?.label || reportType)} | Período: ${escapeHtml(periodOptions.find((item) => item.value === reportPeriod)?.label || reportPeriod)}</div>
          <table>
            <thead><tr><th>Campo</th><th>Valor</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          ${detailColumns.length ? `<h2>Detalhes</h2><table><thead><tr>${detailHeadersHtml}</tr></thead><tbody>${detailRowsHtml}</tbody></table>` : ""}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    toast.success("Janela de impressão aberta. Use “Salvar como PDF” no navegador.");
  };

  const handlePrintReport = () => {
    handleExportPdf();
  };

  const handleAnalyzeCleanup = async () => {
    try {
      const { apiClient } = await import("../utils/api");
      const response = await apiClient.getCleanupAnalysis();

      if (!response.success || !response.stats) {
        throw new Error(response.error || "Erro ao analisar limpeza.");
      }

      setCleanupStats(response.stats);

      if (response.stats?.isAboveLimit) {
        toast.warning("Alerta: o banco já está acima de 3 GB. A limpeza recomendada deve ser priorizada.");
      } else {
        toast.success("Análise de armazenamento concluída.");
      }
    } catch (error: any) {
      console.error("Erro ao analisar limpeza:", error);
      toast.error(error?.message || "Erro ao analisar limpeza de dados.");
    }
  };

  const handleArchiveCleanup = async (section: "requests" | "notifications" | "messages" | "locations" | "financial") => {
    const optionMap = {
      requests: cleanupConfig.oldRequests,
      notifications: cleanupConfig.oldNotifications,
      messages: cleanupConfig.oldMessages,
      locations: cleanupConfig.oldLocations,
      financial: cleanupConfig.financialHistory,
    };

    try {
      const { apiClient } = await import("../utils/api");
      const response = await apiClient.archiveCleanupData(section, optionMap[section]);

      if (!response.success) {
        throw new Error(response.error || "Erro ao arquivar dados.");
      }

      const labels: Record<typeof section, string> = {
        requests: "Solicitações antigas",
        notifications: "Notificações antigas",
        messages: "Mensagens antigas",
        locations: "Localizações antigas",
        financial: "Dados financeiros antigos",
      };

      await recordAuditEvent({
        action: "data.archive",
        entityType: section,
        description: `Arquivou ${response.archivedCount ?? 0} registo(s) de ${labels[section].toLowerCase()}.`,
        details: { section, retention: optionMap[section], archivedCount: response.archivedCount ?? 0 },
      });
      await loadAdminAuditHistory();
      toast.success(`${labels[section]} movida para arquivo histórico (${response.archivedCount ?? 0} item(ns)).`);
    } catch (error: any) {
      console.error("Erro ao arquivar dados:", error);
      toast.error(error?.message || "Erro ao arquivar dados antigos.");
    }
  };

  const handleDeleteCleanup = async (section: "requests" | "notifications" | "messages" | "locations" | "financial") => {
    if (user?.role !== "super_admin") {
      toast.error("A exclusão definitiva só pode ser executada por um superadministrador.");
      return;
    }

    if (cleanupConfirmText !== "CONFIRMAR EXCLUSÃO") {
      toast.error("Digite CONFIRMAR EXCLUSÃO antes de prosseguir.");
      return;
    }

    const optionMap = {
      requests: cleanupConfig.oldRequests,
      notifications: cleanupConfig.oldNotifications,
      messages: cleanupConfig.oldMessages,
      locations: cleanupConfig.oldLocations,
      financial: cleanupConfig.financialHistory,
    };

    try {
      const { apiClient } = await import("../utils/api");
      const response = await apiClient.deleteCleanupData(section, optionMap[section]);

      if (!response.success) {
        throw new Error(response.error || "Erro ao excluir dados.");
      }

      const labels: Record<typeof section, string> = {
        requests: "Solicitações antigas",
        notifications: "Notificações antigas",
        messages: "Mensagens antigas",
        locations: "Localizações antigas",
        financial: "Dados financeiros antigos",
      };

      await recordAuditEvent({
        action: "data.delete",
        entityType: section,
        description: `Excluiu definitivamente ${response.deletedCount ?? 0} registo(s) de ${labels[section].toLowerCase()}.`,
        details: { section, retention: optionMap[section], deletedCount: response.deletedCount ?? 0 },
      });
      await loadAdminAuditHistory();
      setCleanupConfirmText("");
      toast.success(`${labels[section]} removida definitivamente (${response.deletedCount ?? 0} item(ns)).`);
    } catch (error: any) {
      console.error("Erro ao excluir dados:", error);
      toast.error(error?.message || "Erro ao excluir dados antigos.");
    }
  };

  const handleSaveReport = () => {
    if (!reportGenerated || !Object.keys(reportPreview).length) {
      toast.error("Gere primeiro o relatório antes de salvar.");
      return;
    }

    const nextReport = {
      id: `report-${Date.now()}`,
      type: reportType,
      typeLabel: reportTypeOptions.find((item) => item.value === reportType)?.label || reportType,
      period: reportPeriod,
      periodLabel: periodOptions.find((item) => item.value === reportPeriod)?.label || reportPeriod,
      customFrom,
      customTo,
      filters: { selectedMechanic, selectedCustomer, serviceStatus, serviceType, paymentMethod },
      generatedAt: new Date().toISOString(),
      preview: reportPreview,
      rows: reportRows,
    };

    const updated = [nextReport, ...savedReports].slice(0, 20);
    setSavedReports(updated);
    localStorage.setItem("kuidacar_reports", JSON.stringify(updated));
    toast.success("Relatório salvo localmente no navegador.");
  };

  const handleLoadSavedReport = (report: any) => {
    setReportType(report.type);
    setReportPeriod(report.period);
    if (report.customFrom) setCustomFrom(report.customFrom);
    if (report.customTo) setCustomTo(report.customTo);
    if (report.filters) {
      setSelectedMechanic(report.filters.selectedMechanic || "all");
      setSelectedCustomer(report.filters.selectedCustomer || "all");
      setServiceStatus(report.filters.serviceStatus || "all");
      setServiceType(report.filters.serviceType || "all");
      setPaymentMethod(report.filters.paymentMethod || "all");
    }
    setReportPreview(report.preview || {});
    setReportRows(report.rows || []);
    setReportGenerated(true);
    toast.success("Relatório salvo carregado.");
  };

  const handleDeleteSavedReport = (reportId: string) => {
    const updated = savedReports.filter((report) => report.id !== reportId);
    setSavedReports(updated);
    localStorage.setItem("kuidacar_reports", JSON.stringify(updated));
    toast.success("Relatório removido da lista local.");
  };

  const mechanicOptions = useMemo(
    () => [...new Set(profiles.filter((profile: any) => ["provider", "mechanic"].includes(String(profile.role || profile.user_role || "").toLowerCase())).map((profile: any) => ({ id: profile.id, name: profile.name || profile.email || "Prestador" })))],
    [profiles]
  );

  const customerOptions = useMemo(
    () => [...new Set(profiles.filter((profile: any) => String(profile.role || profile.user_role || "").toLowerCase() === "customer").map((profile: any) => ({ id: profile.id, name: profile.name || profile.email || "Cliente" })))],
    [profiles]
  );

  const serviceStatuses = ["all", "pending", "accepted", "in_progress", "completed", "cancelled"];
  const serviceTypes = ["all", "reparo", "bateria", "pneu", "guincho", "diagnostico", "outro"];
  const paymentMethods = ["all", "multicaixa", "money", "card", "pix", "bank_transfer"];

  const [supervisionMode, setSupervisionMode] = useState<"clients" | "mechanics">("clients");
  const [supervisionSearch, setSupervisionSearch] = useState("");
  const [supervisionAdminId, setSupervisionAdminId] = useState<string>("all");
  const [supervisionSelectedIds, setSupervisionSelectedIds] = useState<string[]>([]);
  const [supervisionLastAnchorId, setSupervisionLastAnchorId] = useState<string | null>(null);
  const [supervisionLoading, setSupervisionLoading] = useState(false);

  const supervisionAdmins = useMemo(
    () => profiles.filter((profile: any) => ["admin", "super_admin"].includes(String(profile.role || "").toLowerCase())),
    [profiles]
  );

  const supervisionUsers = useMemo(() => {
    const roleName = supervisionMode === "clients" ? "customer" : "provider";
    const query = supervisionSearch.trim().toLowerCase();

    return profiles.filter((profile: any) => {
      const role = String(profile.role || "").toLowerCase();
      const matchesType = role === roleName || (supervisionMode === "mechanics" && (role === "mechanic" || role === "provider"));
      if (!matchesType) return false;
      if (!query) return true;

      const haystack = `${profile.name || ""} ${profile.email || ""} ${profile.phone || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [profiles, supervisionMode, supervisionSearch]);

  const supervisionStatusText = (profile: any) => {
    if (!profile.supervision_admin_id) {
      return "Supervisão geral — Todos os admins";
    }

    const admin = supervisionAdmins.find((item: any) => item.id === profile.supervision_admin_id);
    return `Supervisão: ${admin?.name || admin?.email || "Administrador"}`;
  };

  const toggleSupervisionSelection = (profileId: string, event?: React.MouseEvent<HTMLInputElement>) => {
    const ids = supervisionUsers.map((profile: any) => profile.id);

    if (event?.shiftKey && supervisionLastAnchorId && ids.includes(supervisionLastAnchorId)) {
      const start = ids.indexOf(supervisionLastAnchorId);
      const end = ids.indexOf(profileId);

      if (start >= 0 && end >= 0) {
        const range = ids.slice(Math.min(start, end), Math.max(start, end) + 1);
        setSupervisionSelectedIds((current) => Array.from(new Set([...current, ...range])));
        return;
      }
    }

    setSupervisionLastAnchorId(profileId);
    setSupervisionSelectedIds((current) => {
      if (current.includes(profileId)) {
        return current.filter((id) => id !== profileId);
      }
      return [...current, profileId];
    });
  };

  const handleSelectAllSupervision = () => {
    const allIds = supervisionUsers.map((profile: any) => profile.id).filter(Boolean);
    if (!allIds.length) return;

    const isAllSelected = allIds.every((id) => supervisionSelectedIds.includes(id));

    setSupervisionSelectedIds((current) => {
      if (isAllSelected) {
        return current.filter((id) => !allIds.includes(id));
      }
      return Array.from(new Set([...current, ...allIds]));
    });
  };

  const handleConfirmSupervisionAssignment = async () => {
    if (user?.role !== "super_admin") {
      toast.error("Apenas um superadministrador pode gerir a supervisão centralizada.");
      return;
    }

    const targetIds = Array.from(new Set(supervisionSelectedIds.filter(Boolean)));
    if (!targetIds.length) {
      toast.error("Selecione pelo menos um cliente ou mecânico para confirmar a atribuição.");
      return;
    }

    setSupervisionLoading(true);

    try {
      const nextAdminId = supervisionAdminId === "all" ? null : supervisionAdminId;
      const { error } = await supabase
        .from("profiles")
        .update({
          supervision_admin_id: nextAdminId,
          updated_at: new Date().toISOString(),
        })
        .in("id", targetIds);

      if (error) throw error;

      const previousAssignments = profiles.filter((profile: any) => targetIds.includes(profile.id));

      setProfiles((current) => current.map((profile: any) => {
        if (!targetIds.includes(profile.id)) return profile;
        return {
          ...profile,
          supervision_admin_id: nextAdminId,
          updated_at: new Date().toISOString(),
        };
      }));

      for (const profile of previousAssignments) {
        const previousAdminId = profile.supervision_admin_id || null;
        const action = previousAdminId && nextAdminId && previousAdminId !== nextAdminId ? 'transferred' : nextAdminId ? 'assigned' : 'removed';
        const note = nextAdminId
            ? `O administrador ${supervisionAdmins.find((admin: any) => admin.id === nextAdminId)?.name || 'responsável'} recebeu ${profile.name || profile.email || 'usuário'}.`
          : `Supervisão removida de ${profile.name || profile.email || 'usuário'}.`;

        await supabase.from('user_supervision_assignments').insert({
          user_id: profile.id,
          previous_admin_id: previousAdminId,
          next_admin_id: nextAdminId,
          assigned_by: user?.id || null,
          action,
          note,
          created_at: new Date().toISOString(),
        });
      }

      await loadSupervisionHistory();
      await loadAdminAuditHistory();
      setSupervisionSelectedIds([]);
      setSupervisionLastAnchorId(null);
      toast.success(nextAdminId ? `Atribuição confirmada para ${supervisionAdmins.find((admin: any) => admin.id === nextAdminId)?.name || "o administrador selecionado"}.` : "Utilizadores colocados em supervisão geral — todos os administradores passam a ver.");
    } catch (err: any) {
      console.error("Erro ao confirmar supervisão:", err);
      toast.error(err?.message || "Não foi possível confirmar a atribuição de supervisão.");
    } finally {
      setSupervisionLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== "super_admin") {
      toast.error("Apenas um superadministrador pode alterar esta configuração.");
      return;
    }
    if (!providerTermsInput.trim() || !customerTermsInput.trim() || !privacyNoticeInput.trim()) {
      toast.error("Preencha os termos para mecânicos e clientes e o aviso de privacidade antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      const value = {
        ...(systemSettings || {}),
        multicaixaNumber: multicaixaNumberInput.trim(),
        paymentIban: paymentIbanInput.trim(),
        supportContactName: supportContactNameInput.trim(),
        supportContactPhone: supportContactPhoneInput.trim(),
        commissionPercentage: PLATFORM_COMMISSION_PERCENTAGE,
        providerTerms: providerTermsInput.trim(),
        customerTerms: customerTermsInput.trim(),
        privacyNotice: privacyNoticeInput.trim(),
        privacyNoticeVersion: systemSettings?.privacyNotice !== privacyNoticeInput.trim()
          ? (Number(systemSettings?.privacyNoticeVersion) || 1) + 1
          : Number(systemSettings?.privacyNoticeVersion) || 1,
        providerTermsVersion: systemSettings?.providerTerms !== providerTermsInput.trim()
          ? (Number(systemSettings?.providerTermsVersion) || 1) + 1
          : Number(systemSettings?.providerTermsVersion) || 1,
        customerTermsVersion: systemSettings?.customerTerms !== customerTermsInput.trim()
          ? (Number(systemSettings?.customerTermsVersion) || 1) + 1
          : Number(systemSettings?.customerTermsVersion) || 1,
      };
      const { error } = await supabase
        .from("system_settings")
        .upsert({ key: "system:settings", value })
        .select();
      if (error) throw error;
      const changedSettings = [
        "multicaixaNumber",
        "paymentIban",
        "supportContactName",
        "supportContactPhone",
        "providerTerms",
        "customerTerms",
        "privacyNotice",
      ].filter((key) => systemSettings?.[key] !== value[key]);
      if (changedSettings.length) {
        await recordAuditEvent({
          action: "settings.update",
          entityType: "system_settings",
          entityId: "system:settings",
          description: `Atualizou configurações do sistema: ${changedSettings.join(", ")}.`,
          details: { changedSettings },
        });
      }
      setSystemSettings(value);
      await loadAdminAuditHistory();
      toast.success("Configurações salvas");
    } catch (err: any) {
      console.error("Erro ao salvar system settings:", err);
      toast.error(err?.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== "super_admin") {
      toast.error("Apenas um superadministrador pode criar administradores.");
      return;
    }
    if (!adminName || !adminEmail || !adminPassword) {
      toast.error("Nome, email e senha são obrigatórios.");
      return;
    }
    setAdminCreating(true);
    try {
      const resp = await (await import("../utils/api")).apiClient.createAdminUser(adminEmail, adminPassword, adminName, "super_admin");
      if (resp.success) {
        await recordAuditEvent({
          action: "admin.create",
          entityType: "admin",
          description: `Criou um superadministrador para ${adminEmail.trim().toLowerCase()}.`,
          details: { email: adminEmail.trim().toLowerCase(), role: "super_admin" },
        });
        await loadAdminAuditHistory();
        toast.success("Administrador criado com sucesso.");
        setAdminEmail("");
        setAdminPassword("");
      } else {
        toast.error(resp.error || "Erro ao criar administrador.");
      }
    } catch (err: any) {
      console.error("Erro ao criar admin:", err);
      toast.error(err?.message || "Erro ao criar admin.");
    } finally {
      setAdminCreating(false);
    }
  };

  const handleCreateAdminRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== "super_admin") {
      toast.error("Apenas um superadministrador pode criar administradores.");
      return;
    }
    if (!adminNameRole || !adminEmailRole || !adminPasswordRole) {
      toast.error("Nome, email e senha são obrigatórios.");
      return;
    }
    setAdminCreatingRole(true);
    try {
      const resp = await (await import("../utils/api")).apiClient.createAdminUser(adminEmailRole, adminPasswordRole, adminNameRole, "admin");
      if (resp.success) {
        await recordAuditEvent({
          action: "admin.create",
          entityType: "admin",
          description: `Criou um administrador para ${adminEmailRole.trim().toLowerCase()}.`,
          details: { email: adminEmailRole.trim().toLowerCase(), role: "admin" },
        });
        await loadAdminAuditHistory();
        toast.success("Administrador criado com sucesso.");
        setAdminEmailRole("");
        setAdminPasswordRole("");
      } else {
        toast.error(resp.error || "Erro ao criar admin.");
      }
    } catch (err: any) {
      console.error("Erro ao criar admin:", err);
      toast.error(err?.message || "Erro ao criar admin.");
    } finally {
      setAdminCreatingRole(false);
    }
  };

  const handleDeleteUserFromDatabase = async () => {
    if (user?.role !== "super_admin") {
      toast.error("Apenas um superadministrador pode remover utilizadores do banco de dados.");
      return;
    }

    if (!userToDeleteId) {
      toast.error("Selecione um utilizador antes de remover.");
      return;
    }

    const selectedUser = profiles.find((profile: any) => String(profile.id) === String(userToDeleteId));
    const userLabel = selectedUser?.name || selectedUser?.email || "este utilizador";

    if (!window.confirm(`Tem a certeza que deseja eliminar permanentemente ${userLabel} do banco de dados?`)) {
      return;
    }

    setDeletingUser(true);

    try {
      const targetId = String(userToDeleteId);

      const { data: serviceRows, error: serviceReadError } = await supabase
        .from("service_requests")
        .select("id")
        .or(`customer_id.eq.${targetId},provider_id.eq.${targetId}`);

      if (serviceReadError) throw serviceReadError;
      for (const row of serviceRows || []) {
        await apiClient.deleteServiceRequest(String(row.id));
      }

      await apiClient.deleteAllNotificationsForUser(targetId);

      const { error: kvError } = await supabase
        .from("kv_store_9dc5328a")
        .delete()
        .eq("key", `user:${targetId}`);
      if (kvError) throw kvError;

      const { data: remainingKvUser, error: verifyKvError } = await supabase
        .from("kv_store_9dc5328a")
        .select("key")
        .eq("key", `user:${targetId}`)
        .maybeSingle();
      if (verifyKvError) throw verifyKvError;
      if (remainingKvUser) throw new Error("O registo do utilizador ainda existe no KV store.");

      const { data: messageRows, error: messageReadError } = await supabase
        .from("messages")
        .select("id")
        .or(`sender_id.eq.${targetId},receiver_id.eq.${targetId}`);
      if (messageReadError) throw messageReadError;
      for (const row of messageRows || []) {
        const { error: deleteMessageError } = await supabase.from("messages").delete().eq("id", row.id);
        if (deleteMessageError) throw deleteMessageError;
      }

      const { error: profileError } = await supabase.from("profiles").delete().eq("id", targetId);
      if (profileError) throw profileError;

      const { data: remainingProfile, error: verifyProfileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", targetId)
        .maybeSingle();
      if (verifyProfileError) throw verifyProfileError;
      if (remainingProfile) throw new Error("O perfil do utilizador ainda existe na tabela profiles.");

      await recordAuditEvent({
        action: "user.delete",
        entityType: "profile",
        entityId: targetId,
        description: `Removeu permanentemente o utilizador ${userLabel} e os dados associados.`,
        details: { removedServiceCount: (serviceRows || []).length },
      });
      await loadAdminAuditHistory();
      setProfiles((current) => current.filter((profile: any) => String(profile.id) !== targetId));
      setUserToDeleteId("");
      toast.success(`${userLabel} foi removido do banco de dados.`);
    } catch (err: any) {
      console.error("Erro ao remover usuário do banco de dados:", err);
      toast.error(err?.message || "Não foi possível remover o utilizador do banco de dados.");
    } finally {
      setDeletingUser(false);
    }
  };

  return (
    <AdminLayout title="Configurações" subtitle="Alterar configurações do sistema e gerar relatórios administrativos">
      <div className="space-y-6">
        <Card className="bg-slate-900 border-slate-700 p-8">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-400 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-white">Controle e Supervisão</h2>
              <p className="text-sm text-slate-400">Atribua clientes ou mecânicos a um administrador responsável. Este responsável passa a ver mensagens do prestador para a administração, histórico, pagamentos e solicitações relacionadas. Utilizadores sem responsável ficam visíveis a todos os administradores.</p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={supervisionMode === "clients" ? "default" : "outline"}
                className={supervisionMode === "clients" ? "bg-orange-600 hover:bg-orange-700" : "border-slate-700 text-slate-200"}
                onClick={() => setSupervisionMode("clients")}
              >
                Clientes
              </Button>
              <Button
                type="button"
                variant={supervisionMode === "mechanics" ? "default" : "outline"}
                className={supervisionMode === "mechanics" ? "bg-orange-600 hover:bg-orange-700" : "border-slate-700 text-slate-200"}
                onClick={() => setSupervisionMode("mechanics")}
              >
                Mecânicos
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_260px]">
              <div>
                <Label htmlFor="supervision-search">Pesquisar usuário</Label>
                <Input
                  id="supervision-search"
                  value={supervisionSearch}
                  onChange={(event) => setSupervisionSearch(event.target.value)}
                  placeholder="Pesquisar por nome, email ou telefone"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="supervision-admin">Administrador responsável</Label>
                <select
                  id="supervision-admin"
                  value={supervisionAdminId}
                  onChange={(event) => setSupervisionAdminId(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  <option value="all">Todos os administradores</option>
                  {supervisionAdmins.map((admin: any) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name || admin.email || "Administrador"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-200">Lista de utilizadores</span>
                <Button type="button" variant="outline" size="sm" className="border-slate-700 text-slate-300" onClick={handleSelectAllSupervision}>
                  Selecionar todos
                </Button>
              </div>

              <div className="max-h-[360px] space-y-2 overflow-auto">
                {supervisionUsers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-sm text-slate-400">
                    Nenhum utilizador encontrado.
                  </div>
                ) : supervisionUsers.map((profile: any) => {
                  const selected = supervisionSelectedIds.includes(profile.id);
                  const isAssigned = Boolean(profile.supervision_admin_id);
                  const adminName = supervisionAdmins.find((admin: any) => admin.id === profile.supervision_admin_id)?.name || "Administrador";

                  return (
                    <label
                      key={profile.id}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 transition ${selected ? "border-orange-500 bg-orange-500/10" : "border-slate-700 bg-slate-900/70 hover:border-slate-500"}`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) => toggleSupervisionSelection(profile.id, event as any)}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-orange-600 focus:ring-orange-500"
                          aria-label={`Selecionar ${profile.name || profile.email}`}
                        />
                        <div>
                          <div className="text-sm font-medium text-white">{profile.name || profile.email || "Utilizador sem nome"}</div>
                          <div className="text-xs text-slate-400">{supervisionMode === "clients" ? "Cliente" : "Mecânico"}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`text-xs font-medium ${isAssigned ? "text-emerald-400" : "text-slate-400"}`}>
                          {isAssigned ? "🟢 Selecionado" : "🌐 Supervisão geral"}
                        </div>
                        {isAssigned && (
                          <div className="text-[10px] text-slate-300">{adminName}</div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handleConfirmSupervisionAssignment}
                disabled={supervisionLoading || !supervisionSelectedIds.length}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
              >
                {supervisionLoading ? "Confirmando..." : "Confirmar atribuição"}
              </Button>
              {user?.role === "super_admin" && (
                <Button type="button" variant="outline" className="border-slate-700 text-slate-200" onClick={() => setSupervisionSelectedIds([])}>
                  Limpar seleção
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900 border-slate-700 p-8">
          <div className="flex items-start gap-3">
            <Archive className="w-6 h-6 text-emerald-400 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-white">Histórico de supervisão</h2>
              <p className="text-sm text-slate-400">Registro de atribuições, transferências e remoção de supervisão.</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="mb-4">
              <Input
                placeholder="Pesquisar histórico por nome, admin, ação..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full max-w-md"
              />
            </div>

            {(() => {
              const q = (historySearch || "").trim().toLowerCase();
              const filtered = q
                ? supervisionHistory.filter((event: any) => {
                    const actor = event.assigned_by ? (profiles.find((p: any) => p.id === event.assigned_by)?.name || "") : "";
                    const userName = profiles.find((profile: any) => profile.id === event.user_id)?.name || "";
                    const prev = profiles.find((p: any) => p.id === event.previous_admin_id)?.name || "";
                    const next = profiles.find((p: any) => p.id === event.next_admin_id)?.name || "";
                    const hay = `${actor} ${userName} ${prev} ${next} ${event.action || ""} ${event.note || ""}`.toLowerCase();
                    return hay.includes(q);
                  })
                : supervisionHistory;

              if (filtered.length === 0) {
                return (
                  <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                    Ainda não há histórico de supervisão.
                  </div>
                );
              }

              return filtered.map((event: any) => {
                const actor = event.assigned_by ? (profiles.find((profile: any) => profile.id === event.assigned_by)?.name || "Administrador") : "Sistema";
                const previousAdmin = event.previous_admin_id ? (profiles.find((profile: any) => profile.id === event.previous_admin_id)?.name || "Administrador") : null;
                const nextAdmin = event.next_admin_id ? (profiles.find((profile: any) => profile.id === event.next_admin_id)?.name || "Administrador") : null;
                const userName = profiles.find((profile: any) => profile.id === event.user_id)?.name || "Usuário";
                const formattedDate = event.dateLabel || new Date(event.created_at || Date.now()).toLocaleDateString("pt-BR");

                let text = `${actor} atribuiu ${userName} ao ${nextAdmin || "administrador"}.`;
                if (event.action === 'transferred') {
                  text = `${actor} transferiu ${userName} de ${previousAdmin || "administrador anterior"} para ${nextAdmin || "novo administrador"}.`;
                }
                if (event.action === 'removed') {
                  text = `${actor} removeu a supervisão de ${userName}.`;
                }

                return (
                  <div key={event.id || `${event.user_id}-${event.created_at}`} className="rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200">
                    <div className="font-medium text-slate-100">{formattedDate}</div>
                    <div className="mt-1 text-slate-300">{text}</div>
                  </div>
                );
              });
            })()}
          </div>
        </Card>

        <Card className="bg-slate-900 border-slate-700 p-8">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 h-6 w-6 text-orange-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Auditoria administrativa</h2>
              <p className="text-sm text-slate-400">Regista quem executou ações administrativas, alterações de acesso e operações relevantes.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {auditHistoryError && (
              <div role="alert" className="rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
                {auditHistoryError}
              </div>
            )}
            {adminAuditHistory.length === 0 && !auditHistoryError ? (
              <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                Ainda não há ações administrativas registadas.
              </div>
            ) : adminAuditHistory
              .filter((event: any) => {
                const query = historySearch.trim().toLowerCase();
                if (!query) return true;
                const actorName = profiles.find((profile: any) => profile.id === event.actor_id)?.name || "";
                const targetName = profiles.find((profile: any) => profile.id === event.entity_id)?.name || "";
                return `${actorName} ${targetName} ${event.action} ${event.entity_type} ${event.entity_id} ${event.description} ${JSON.stringify(event.details || {})}`
                  .toLowerCase()
                  .includes(query);
              })
              .map((event: any) => {
                const actor = profiles.find((profile: any) => profile.id === event.actor_id);
                const target = profiles.find((profile: any) => profile.id === event.entity_id);
                const actionLabel = adminAuditActionLabels[event.action] || event.action;
                const details = event.details || {};
                const changedFields: string[] = details.changedFields || [];
                const previousAdmin = profiles.find((profile: any) => profile.id === details.previousAdminId);
                const nextAdmin = profiles.find((profile: any) => profile.id === details.nextAdminId);
                const context = event.action === "supervision.assignment"
                  ? `Supervisão: ${previousAdmin?.name || "supervisão geral"} → ${nextAdmin?.name || "todos os administradores"}`
                  : details.previousStatus != null || details.nextStatus != null
                    ? `Estado: ${details.previousStatus || "—"} → ${details.nextStatus || "—"}`
                    : changedFields.includes("role")
                      ? `Perfil: ${details.previousRole || "—"} → ${details.nextRole || "—"}`
                      : changedFields.includes("is_blocked")
                        ? `Bloqueado: ${details.previousBlocked || "false"} → ${details.nextBlocked || "false"}`
                        : changedFields.includes("is_active") || changedFields.includes("is_verified")
                          ? `Estado/permissão alterado: ${changedFields.filter((field) => ["is_active", "is_verified"].includes(field)).join(", ")}`
                          : "";
                return (
                  <div key={event.id} className="rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-100">{event.actor_name || actor?.name || actor?.email || "Administrador"}</span>
                      <time className="text-xs text-slate-400" dateTime={event.created_at}>
                        {new Date(event.created_at).toLocaleString("pt-BR")}
                      </time>
                    </div>
                    <p className="mt-1 text-slate-300">{event.description}</p>
                    {context && <p className="mt-1 text-xs text-slate-400">{context}</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      Ação: {actionLabel} · Tipo: {event.entity_type}
                      {event.entity_id ? ` · Alvo: ${target?.name || target?.email || event.entity_id}` : ""}
                    </p>
                  </div>
                );
              })}
          </div>
        </Card>

        {user?.role === "super_admin" && (
          <Card className="bg-slate-900 border-slate-700 p-8">
            <div className="flex items-start gap-3">
              <Settings className="w-6 h-6 text-slate-400 mt-1" />
              <div>
                <h2 className="text-lg font-semibold text-white">Configurações do sistema</h2>
                <p className="text-sm text-slate-400">Altere os dados globais de pagamento mostrados aos prestadores.</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="multicaixa-number">Número Multicaixa Express</Label>
                <Input id="multicaixa-number" value={multicaixaNumberInput} onChange={(e) => setMulticaixaNumberInput(e.target.value)} placeholder="929630902" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-iban">IBAN</Label>
                <Input id="payment-iban" value={paymentIbanInput} onChange={(e) => setPaymentIbanInput(e.target.value)} placeholder="0000 0055 3033 2012 1011 7" />
              </div>
              <div className="border-t border-slate-700 pt-4">
                <h3 className="font-semibold text-white">Contacto KuidaCar na página inicial</h3>
                <p className="mt-1 text-sm text-slate-400">Este contacto será apresentado publicamente no final da página inicial.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-contact-name">Nome do contacto</Label>
                <Input
                  id="support-contact-name"
                  value={supportContactNameInput}
                  onChange={(e) => setSupportContactNameInput(e.target.value)}
                  placeholder="Ex.: Apoio KuidaCar"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-contact-phone">Contacto telefónico</Label>
                <Input
                  id="support-contact-phone"
                  type="tel"
                  value={supportContactPhoneInput}
                  onChange={(e) => setSupportContactPhoneInput(e.target.value)}
                  placeholder="Ex.: +244 900 000 000"
                  maxLength={30}
                />
              </div>
              <div className="border-t border-slate-700 pt-4">
                <h3 className="font-semibold text-white">Termos e condições</h3>
                <p className="mt-1 text-sm text-slate-400">Os termos e o aviso de privacidade são apresentados no primeiro acesso e quando uma nova versão é publicada; continuam disponíveis nas definições de cada utilizador.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-terms">Termos e condições para mecânicos/prestadores</Label>
                <Textarea
                  id="provider-terms"
                  value={providerTermsInput}
                  onChange={(e) => setProviderTermsInput(e.target.value)}
                  placeholder="Escreva os termos e regras aplicáveis aos prestadores."
                  maxLength={20000}
                  rows={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-terms">Termos e condições para clientes</Label>
                <Textarea
                  id="customer-terms"
                  value={customerTermsInput}
                  onChange={(e) => setCustomerTermsInput(e.target.value)}
                  placeholder="Escreva os termos e regras aplicáveis aos clientes."
                  maxLength={20000}
                  rows={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="privacy-notice">Aviso de privacidade para todos os utilizadores</Label>
                <Textarea
                  id="privacy-notice"
                  value={privacyNoticeInput}
                  onChange={(e) => setPrivacyNoticeInput(e.target.value)}
                  placeholder="Explique quais dados são recolhidos, para que são usados, com quem são partilhados e como contactar a KuidaCar."
                  maxLength={30000}
                  rows={10}
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-700">
                  {saving ? "Salvando..." : "Salvar configurações"}
                </Button>
                <Button type="button" variant="outline" onClick={loadSystemSettings} className="border-slate-700 text-slate-300">
                  Recarregar
                </Button>
              </div>
            </form>

            <div className="mt-8 space-y-6">
              <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-4">
                <div className="flex items-center gap-2 text-red-200">
                  <UserX className="h-5 w-5" />
                  <h3 className="text-md font-semibold text-white">Eliminar utilizador do banco de dados</h3>
                </div>
                <p className="mt-2 text-sm text-slate-300">Apenas um superadministrador pode visualizar e executar esta ação. Remove o registo do utilizador, da lista de perfis e dos dados relacionados.</p>

                <div className="mt-4 space-y-3">
                  <div>
                    <Label htmlFor="delete-user-select">Utilizador</Label>
                    <select
                      id="delete-user-select"
                      value={userToDeleteId}
                      onChange={(event) => setUserToDeleteId(event.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Selecione um utilizador</option>
                      {profiles.map((profile: any) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name || profile.email || profile.id} ({profile.role || "user"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteUserFromDatabase}
                    disabled={!userToDeleteId || deletingUser}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deletingUser ? "Eliminando..." : "Eliminar utilizador"}
                  </Button>
                </div>
              </div>

              <h3 className="text-md font-semibold text-white">Criar superadministrador</h3>
              <form onSubmit={handleCreateAdmin} className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="admin-name">Nome</Label>
                  <Input id="admin-name" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Nome do superadministrador" />
                </div>
                <div>
                  <Label htmlFor="admin-email">E-mail</Label>
                  <Input id="admin-email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@exemplo.com" />
                </div>
                <div>
                  <Label htmlFor="admin-password">Senha</Label>
                  <Input id="admin-password" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Senha" />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={adminCreating}>
                    {adminCreating ? "Criando..." : "Criar superadministrador"}
                  </Button>
                  <Button variant="outline" onClick={() => { setAdminEmail(""); setAdminPassword(""); }}>
                    Limpar
                  </Button>
                </div>
              </form>

              <div className="mt-8">
                <h3 className="text-md font-semibold text-white">Criar administrador</h3>
                <form onSubmit={handleCreateAdminRole} className="mt-4 space-y-4">
                  <div>
                    <Label htmlFor="admin-role-name">Nome</Label>
                    <Input id="admin-role-name" value={adminNameRole} onChange={(e) => setAdminNameRole(e.target.value)} placeholder="Nome do administrador" />
                  </div>
                  <div>
                    <Label htmlFor="admin-role-email">E-mail</Label>
                    <Input id="admin-role-email" value={adminEmailRole} onChange={(e) => setAdminEmailRole(e.target.value)} placeholder="admin@exemplo.com" />
                  </div>
                  <div>
                    <Label htmlFor="admin-role-password">Senha</Label>
                    <Input id="admin-role-password" type="password" value={adminPasswordRole} onChange={(e) => setAdminPasswordRole(e.target.value)} placeholder="Senha" />
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={adminCreatingRole}>
                      {adminCreatingRole ? "Criando..." : "Criar administrador"}
                    </Button>
                    <Button variant="outline" onClick={() => { setAdminEmailRole(""); setAdminPasswordRole(""); }}>
                      Limpar
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </Card>
        )}

        <Card className="bg-slate-900 border-slate-700 p-8">
          <div className="flex items-start gap-3">
            <Database className="mt-1 h-6 w-6 text-emerald-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Limpeza e gestão de dados</h2>
              <p className="text-sm text-white">Arquive ou remova registros antigos com controle, seguindo regras de retenção e auditoria.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-white">Solicitações antigas</h3>
                <select
                  value={cleanupConfig.oldRequests}
                  onChange={(event) => setCleanupConfig((current) => ({ ...current, oldRequests: event.target.value }))}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
                >
                  <option value="6months">Mais de 6 meses</option>
                  <option value="12months">Mais de 12 meses</option>
                  <option value="18months">Mais de 18 meses</option>
                </select>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => handleArchiveCleanup("requests")} className="border-slate-700 text-white">
                  <Archive className="mr-2 h-4 w-4 text-white" />
                  Arquivar
                </Button>
                <Button type="button" variant="destructive" onClick={() => handleDeleteCleanup("requests")} disabled={user?.role !== "super_admin"}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-white">Notificações antigas</h3>
                <select
                  value={cleanupConfig.oldNotifications}
                  onChange={(event) => setCleanupConfig((current) => ({ ...current, oldNotifications: event.target.value }))}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
                >
                  <option value="90days">Mais de 90 dias</option>
                  <option value="180days">Mais de 180 dias</option>
                  <option value="365days">Mais de 365 dias</option>
                </select>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => handleArchiveCleanup("notifications")} className="border-slate-700 text-white">
                  <Archive className="mr-2 h-4 w-4 text-white" />
                  Limpar
                </Button>
                <Button type="button" variant="destructive" onClick={() => handleDeleteCleanup("notifications")} disabled={user?.role !== "super_admin"}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-white">Mensagens antigas</h3>
                <select
                  value={cleanupConfig.oldMessages}
                  onChange={(event) => setCleanupConfig((current) => ({ ...current, oldMessages: event.target.value }))}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
                >
                  <option value="12months">Mais de 12 meses</option>
                  <option value="24months">Mais de 24 meses</option>
                  <option value="36months">Mais de 36 meses</option>
                </select>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => handleArchiveCleanup("messages")} className="border-slate-700 text-white">
                  <Archive className="mr-2 h-4 w-4 text-white" />
                  Arquivar
                </Button>
                <Button type="button" variant="destructive" onClick={() => handleDeleteCleanup("messages")} disabled={user?.role !== "super_admin"}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-white">Localizações antigas</h3>
                <select
                  value={cleanupConfig.oldLocations}
                  onChange={(event) => setCleanupConfig((current) => ({ ...current, oldLocations: event.target.value }))}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
                >
                  <option value="30days">Mais de 30 dias</option>
                  <option value="60days">Mais de 60 dias</option>
                  <option value="90days">Mais de 90 dias</option>
                </select>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => handleArchiveCleanup("locations")} className="border-slate-700 text-white">
                  <Archive className="mr-2 h-4 w-4 text-white" />
                  Arquivar
                </Button>
                <Button type="button" variant="destructive" onClick={() => handleDeleteCleanup("locations")} disabled={user?.role !== "super_admin"}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-white">Dados financeiros</h3>
                <select
                  value={cleanupConfig.financialHistory}
                  onChange={(event) => setCleanupConfig((current) => ({ ...current, financialHistory: event.target.value }))}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
                >
                  <option value="keep">Manter histórico completo</option>
                  <option value="archive">Arquivar histórico antigo</option>
                  <option value="delete">Excluir registros conflitantes</option>
                </select>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => handleArchiveCleanup("financial")} className="border-slate-700 text-white">
                  <Archive className="mr-2 h-4 w-4 text-white" />
                  Arquivar
                </Button>
                <Button type="button" variant="destructive" onClick={() => handleDeleteCleanup("financial")} disabled={user?.role !== "super_admin"}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-slate-700 bg-slate-950/70 p-5">
            <div className="flex items-center gap-2 text-white">
              <ShieldAlert className="h-5 w-5 text-amber-400" />
              <p className="text-sm font-semibold">Espaço e retenção</p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Banco utilizado</p>
                <p className="mt-2 text-2xl font-bold text-white">{cleanupStats.databaseUsed.toFixed(2)} GB</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Dados arquivados</p>
                <p className="mt-2 text-2xl font-bold text-white">{cleanupStats.archivedData.toFixed(2)} GB</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Remoção possível</p>
                <p className="mt-2 text-2xl font-bold text-white">{cleanupStats.removableData.toFixed(2)} GB</p>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                <span>Uso atual</span>
                <span>{Math.min((cleanupStats.databaseUsed / 3) * 100, 100).toFixed(0)}% do limite</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${cleanupStats.isAboveLimit ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min((cleanupStats.databaseUsed / 3) * 100, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Limite de alerta: 3 GB — {cleanupStats.isAboveLimit ? 'ultrapassado' : 'dentro do limite'}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                value={cleanupConfirmText}
                onChange={(event) => setCleanupConfirmText(event.target.value)}
                placeholder="Digite CONFIRMAR EXCLUSÃO"
                className="bg-slate-950 text-white placeholder:text-slate-400"
              />
              <Button type="button" onClick={handleAnalyzeCleanup} className="bg-emerald-600 text-white hover:bg-emerald-700">
                Analisar e limpar
              </Button>
            </div>

            {cleanupStats.isAboveLimit && (
              <div className="mt-4 rounded-lg border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">
                Atenção: o uso real do banco já ultrapassou 3 GB. Recomendamos priorizar arquivamento e remoção de registros antigos.
              </div>
            )}

            <p className="mt-3 text-xs text-slate-400">
              A limpeza é executada apenas sobre dados reais do banco: service_requests, messages, profiles e kv_store_9dc5328a. A exclusão definitiva exige confirmação explícita e acesso de superadministrador.
            </p>
          </div>
        </Card>

        <Card className="bg-slate-900 border-slate-700 p-8">
          <div className="mb-6 flex items-start gap-3">
            <BarChart3 className="mt-1 h-6 w-6 text-orange-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Gerar relatório</h2>
              <p className="text-sm text-white">Estruture relatórios por categoria, período, tipo e filtros para análise administrativa.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="report-type" className="text-white">Tipo de relatório</Label>
              <select id="report-type" value={reportType} onChange={(event) => { setReportGenerated(false); setReportType(event.target.value as ReportType); }} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                {reportTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-period" className="text-white">Período</Label>
              <select id="report-period" value={reportPeriod} onChange={(event) => { setReportGenerated(false); setReportPeriod(event.target.value as PeriodType); }} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mechanic-filter" className="text-white">Mecânico</Label>
              <select id="mechanic-filter" value={selectedMechanic} onChange={(event) => { setReportGenerated(false); setSelectedMechanic(event.target.value); }} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                <option value="all">Todos os mecânicos</option>
                {mechanicOptions.map((mechanic) => (
                  <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-filter" className="text-white">Cliente</Label>
              <select id="customer-filter" value={selectedCustomer} onChange={(event) => { setReportGenerated(false); setSelectedCustomer(event.target.value); }} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                <option value="all">Todos os clientes</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter" className="text-white">Estado do serviço</Label>
              <select id="status-filter" value={serviceStatus} onChange={(event) => { setReportGenerated(false); setServiceStatus(event.target.value); }} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                {serviceStatuses.map((status) => (
                  <option key={status} value={status}>{status === "all" ? "Todos" : status}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type-filter" className="text-white">Tipo de serviço</Label>
              <select id="type-filter" value={serviceType} onChange={(event) => { setReportGenerated(false); setServiceType(event.target.value); }} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                {serviceTypes.map((type) => (
                  <option key={type} value={type}>{type === "all" ? "Todos" : type}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-filter" className="text-white">Forma de pagamento</Label>
              <select id="payment-filter" value={paymentMethod} onChange={(event) => { setReportGenerated(false); setPaymentMethod(event.target.value); }} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>{method === "all" ? "Todos" : method}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-date-from" className="text-white">Data inicial</Label>
              <Input id="report-date-from" type="date" value={customFrom} onChange={(event) => { setReportGenerated(false); setCustomFrom(event.target.value); }} className="bg-slate-950 text-white" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-date-to" className="text-white">Data final</Label>
              <Input id="report-date-to" type="date" value={customTo} onChange={(event) => { setReportGenerated(false); setCustomTo(event.target.value); }} className="bg-slate-950 text-white" />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={handleGenerateReport} disabled={reportLoading} className="bg-orange-600 text-white hover:bg-orange-700">
              {reportLoading ? "Gerando..." : "Gerar relatório"}
            </Button>
            <Button variant="outline" onClick={handleSaveReport} className="border-slate-700 text-white">
              <CalendarRange className="mr-2 h-4 w-4 text-white" />
              Salvar lista
            </Button>
            <Button variant="outline" onClick={() => setSavedReports(JSON.parse(localStorage.getItem("kuidacar_reports") || "[]"))} className="border-slate-700 text-white">
              <FileText className="mr-2 h-4 w-4 text-white" />
              Ver lista salva
            </Button>
            <Button variant="outline" onClick={handleExportCsv} className="border-slate-700 text-white">
              <Download className="mr-2 h-4 w-4 text-white" />
              CSV
            </Button>
            <Button variant="outline" onClick={handleExportExcel} className="border-slate-700 text-white">
              <FileText className="mr-2 h-4 w-4 text-white" />
              Excel
            </Button>
            <Button variant="outline" onClick={handlePrintReport} className="border-slate-700 text-white">
              <Printer className="mr-2 h-4 w-4 text-white" />
              Imprimir / PDF
            </Button>
          </div>

          {savedReports.length > 0 && (
            <div className="mt-8 rounded-xl border border-slate-700 bg-slate-950/70 p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Relatórios salvos localmente</p>
                <span className="text-xs text-white">{savedReports.length} item(ns)</span>
              </div>
              <div className="space-y-3">
                {savedReports.map((report) => (
                  <div key={report.id} className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-white p-3 text-black md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-black">{report.typeLabel}</p>
                      <p className="text-xs text-slate-600">{report.periodLabel} • {new Date(report.generatedAt).toLocaleString("pt-BR")}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => handleLoadSavedReport(report)}>
                        Carregar
                      </Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteSavedReport(report.id)}>
                        Limpar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 rounded-xl border border-slate-700 bg-slate-950/70 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Pré-visualização</p>
                <p className="text-xs text-white">Resumo do relatório com os filtros selecionados.</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {reportGenerated && Object.entries(reportPreview).length > 0 ? (
                Object.entries(reportPreview).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-700 bg-white p-3 text-black">
                    <p className="text-[11px] uppercase tracking-wide text-slate-600">{label}</p>
                    <p className="mt-2 text-2xl font-bold text-black">{String(value)}</p>
                  </div>
                ))
              ) : (
                <div className="col-span-full rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-8 text-sm text-white">
                  Ajuste os filtros e clique em “Gerar relatório” para calcular e apresentar os resultados.
                </div>
              )}
            </div>
          </div>

          {reportGenerated && reportRows.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-xl border border-slate-700">
              <div className="bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Detalhes do período</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-200">
                  <thead className="bg-slate-900 text-slate-300">
                    <tr>
                      {Object.keys(reportRows[0]).map((column) => (
                        <th key={column} className="px-4 py-3 capitalize">
                          {({
                            id: "ID",
                            cliente: "Cliente",
                            mecanico: "Mecânico",
                            data: "Data",
                            status: "Estado",
                            valor: "Valor",
                            admin: "Administrador",
                            ação: "Ação",
                            alvo: "Alvo",
                            detalhes: "Detalhes",
                          } as Record<string, string>)[column] || column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-800">
                        {Object.keys(reportRows[0]).map((column) => {
                          const value = row[column];
                          const displayValue = column === "data" && value
                            ? new Date(value).toLocaleString("pt-BR")
                            : column === "valor"
                              ? formatMoney(value)
                              : String(value ?? "--");
                          return <td key={column} className="px-4 py-3">{displayValue}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};
