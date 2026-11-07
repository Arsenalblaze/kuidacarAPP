import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../utils/api";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  LogOut,
  Camera,
  Save,
  Star,
  TrendingUp,
  Wrench,
  Car as CarIcon,
  Settings,
  KeyRound,
  FileText,
  Download,
  Trash2,
  PencilLine,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../utils/api";

export default function UserProfile() {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"profile" | "password" | "provider-report" | "customer-report" | "terms" | "cache">("profile");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [providerReportData, setProviderReportData] = useState<any[]>([]);
  const [customerReportData, setCustomerReportData] = useState<any[]>([]);
  const [cacheItems, setCacheItems] = useState<any[]>([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentNumber, setPaymentNumber] = useState("929630902");
  const [paymentIban, setPaymentIban] = useState("0000 0055 3033 2012 1011 7");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"multicaixa" | "iban">("multicaixa");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [providerDocumentType, setProviderDocumentType] = useState(user?.documentType || "");
  const [providerDocumentUrl, setProviderDocumentUrl] = useState(user?.documentUrl || "");
  const [providerDocumentSaving, setProviderDocumentSaving] = useState(false);
  const [accountTerms, setAccountTerms] = useState("");
  const [accountPrivacyNotice, setAccountPrivacyNotice] = useState("");
  const [accountTermsLoading, setAccountTermsLoading] = useState(false);
  const [accountTermsError, setAccountTermsError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    vehicleModel: user?.vehicleModel || "",
    vehiclePlate: user?.vehiclePlate || "",
  });

  useEffect(() => {
    if (!user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user) {
      setProviderDocumentType(user.documentType || "");
      setProviderDocumentUrl(user.documentUrl || "");
    }
  }, [user?.documentType, user?.documentUrl]);

  useEffect(() => {
    if (user?.role !== "provider") return;

    apiClient.getSystemSettings()
      .then((response) => {
        if (!response.success || !response.settings) return;
        setPaymentNumber(response.settings.multicaixaNumber || response.settings.defaultMulticaixaNumber || "929630902");
        setPaymentIban(response.settings.paymentIban || "0000 0055 3033 2012 1011 7");
      })
      .catch((error) => {
        console.warn("Erro ao carregar configurações de pagamento:", error);
        toast.error("Não foi possível carregar os dados de pagamento.");
      });
  }, [user?.id, user?.role]);

  if (!user) {
    return null;
  }

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(value || 0).replace("AOA", "Kz");

  useEffect(() => {
    if (user?.role !== "provider" && user?.role !== "customer") return;

    let isActive = true;
    setAccountTermsLoading(true);
    setAccountTermsError(null);
    apiClient.getTermsForRole(user.role)
      .then((response) => {
        if (!isActive) return;
        if (!response.success) {
          setAccountTermsError(response.error || "Não foi possível carregar os termos e condições.");
          return;
        }
        setAccountTerms(response.content);
        setAccountPrivacyNotice(response.privacyNotice || "");
      })
      .catch((error) => {
        if (!isActive) return;
        setAccountTermsError(error instanceof Error ? error.message : "Não foi possível carregar os termos e condições.");
      })
      .finally(() => {
        if (isActive) setAccountTermsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [user?.id, user?.role]);

  const buildPdfBlob = (title: string, lines: string[]) => {
    const escapePdfText = (value: string) =>
      value
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        .replace(/\r/g, "")
        .replace(/\n/g, " ");

    const content = lines
      .map((line, index) => `BT /F1 11 Tf 50 ${760 - index * 18} Td (${escapePdfText(line)}) Tj ET`)
      .join("\n");

    const objects: string[] = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ];

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [0];

    objects.forEach((obj, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new Blob([pdf], { type: "application/pdf" });
  };

  const downloadReportPdf = (title: string, lineItems: string[]) => {
    const blob = buildPdfBlob(title, lineItems);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado em PDF");
  };

  const handleSave = async () => {
    try {
      await updateProfile(formData);
      setIsEditing(false);
      toast.success("Perfil atualizado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao atualizar perfil:", error);
      toast.error(error?.message || "Não foi possível atualizar o perfil.");
    }
  };

  const handleSaveProviderDocument = async () => {
    if (!isProvider) return;

    if (!providerDocumentType.trim()) {
      toast.error("Selecione o tipo do documento do prestador.");
      return;
    }

    if (!providerDocumentUrl.trim()) {
      toast.error("Anexe a imagem do documento do prestador.");
      return;
    }

    try {
      setProviderDocumentSaving(true);
      const response = await apiClient.saveProviderDocument(user.id, {
        documentType: providerDocumentType,
        documentUrl: providerDocumentUrl,
      });

      if (!response.success) {
        throw new Error(response.error || "Não foi possível guardar o documento.");
      }

      toast.success("Documento enviado com sucesso. Aguarde a revisão do administrador.");
    } catch (error: any) {
      console.error("Erro ao salvar documento do prestador:", error);
      toast.error(error?.message || "Não foi possível enviar o documento.");
    } finally {
      setProviderDocumentSaving(false);
    }
  };

  const handleDeleteProviderDocument = async () => {
    if (!isProvider || !window.confirm("Deseja eliminar o documento guardado? O administrador verá um aviso amarelo de documento removido até marcar que tomou conhecimento.")) {
      return;
    }

    try {
      setProviderDocumentSaving(true);
      const response = await apiClient.deleteProviderDocument(user.id);
      if (!response.success) {
        throw new Error(response.error || "Não foi possível eliminar o documento.");
      }

      setProviderDocumentType("");
      setProviderDocumentUrl("");
      toast.success("Documento eliminado. O administrador será avisado no painel.");
    } catch (error: any) {
      console.error("Erro ao eliminar documento do prestador:", error);
      toast.error(error?.message || "Não foi possível eliminar o documento.");
    } finally {
      setProviderDocumentSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast.error("Preencha a senha atual, nova senha e confirmação.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("A confirmação da nova senha não coincide.");
      return;
    }

    try {
      setPasswordLoading(true);

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError || !signInData.user) {
        throw new Error("Senha atual incorreta.");
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        throw updateError;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha alterada com sucesso!");
    } catch (error: any) {
      console.error("Erro ao alterar senha:", error);
      toast.error(error?.message || "Não foi possível alterar a senha.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const buildProviderReport = async () => {
    try {
      setReportLoading(true);

      const { data: services, error: servicesError } = await supabase
        .from("service_requests")
        .select("*, customer:profiles!service_requests_customer_id_fkey(id, name, email)")
        .eq("provider_id", user.id)
        .in("status", ["completed", "finalized", "finalizado"])
        .order("created_at", { ascending: true });

      if (servicesError) throw servicesError;

      const { data: reviews, error: reviewsError } = await supabase
        .from("mechanic_reviews")
        .select("rating, created_at, customer_id")
        .eq("mechanic_id", user.id);

      if (reviewsError) throw reviewsError;

      const customerNames = new Map<string, string>();
      (services || []).forEach((request: any) => {
        const customer = request.customer;
        if (customer?.id && customer?.name) {
          customerNames.set(String(customer.id), customer.name);
        }
      });

      const grouped = new Map<string, { date: string; count: number; total: number; customers: Set<string>; ratings: number[] }>();

      (services || []).forEach((request: any) => {
        const date = new Date(request.created_at).toISOString().split("T")[0];
        const current = grouped.get(date) || { date, count: 0, total: 0, customers: new Set<string>(), ratings: [] };
        current.count += 1;
        current.total += Number(request.price || request.estimatedPrice || 0);
        if (request.customer_id) current.customers.add(String(request.customer_id));
        grouped.set(date, current);
      });

      const rows = Array.from(grouped.values()).map((item) => ({
        date: item.date,
        atendimentos: item.count,
        valor: item.total,
        clientes: item.customers.size,
        clientesNomes: [...item.customers].map((customerId) => customerNames.get(customerId) || "Cliente desconhecido").join(", "),
        avaliacao: 0,
      }));

      const ratings = (reviews || []).map((review: any) => Number(review.rating || 0));
      const averageRating = ratings.length ? ratings.reduce((sum, item) => sum + item, 0) / ratings.length : 0;

      rows.forEach((row) => {
        row.avaliacao = Number(averageRating.toFixed(1));
      });

      setProviderReportData(rows);
      toast.success("Relatório do prestador gerado com sucesso.");
    } catch (error: any) {
      console.error("Erro ao gerar relatório do prestador:", error);
      toast.error(error?.message || "Não foi possível gerar o relatório do prestador.");
    } finally {
      setReportLoading(false);
    }
  };

  const buildCustomerReport = async () => {
    try {
      setReportLoading(true);

      const { data: services, error } = await supabase
        .from("service_requests")
        .select("*, provider:profiles!service_requests_provider_id_fkey(id, name, email)")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const grouped = new Map<string, { date: string; count: number; total: number; providers: Set<string>; status: string[] }>();

      (services || []).forEach((request: any) => {
        const date = new Date(request.created_at).toISOString().split("T")[0];
        const current = grouped.get(date) || { date, count: 0, total: 0, providers: new Set<string>(), status: [] as string[] };
        current.count += 1;
        current.total += Number(request.price || request.estimatedPrice || 0);
        if (request.provider_id) current.providers.add(String(request.provider_id));
        current.status.push(String(request.status || ""));
        grouped.set(date, current);
      });

      const providerNames = new Map<string, string>();
      (services || []).forEach((request: any) => {
        const provider = request.provider;
        if (provider?.id && provider?.name) {
          providerNames.set(String(provider.id), provider.name);
        }
      });

      const rows = Array.from(grouped.values()).map((item) => ({
        date: item.date,
        solicitacoes: item.count,
        valorTotal: item.total,
        prestadores: item.providers.size,
        prestadoresNomes: [...item.providers].map((providerId) => providerNames.get(providerId) || "Mecânico desconhecido").join(", "),
        status: item.status.join(", "),
      }));

      setCustomerReportData(rows);
      toast.success("Relatório do cliente gerado com sucesso.");
    } catch (error: any) {
      console.error("Erro ao gerar relatório do cliente:", error);
      toast.error(error?.message || "Não foi possível gerar o relatório do cliente.");
    } finally {
      setReportLoading(false);
    }
  };

  const buildScopedCacheItems = async () => {
    if (!user) return;

    const items: any[] = [];
    const scopedLocalKeys = user.role === "provider"
      ? [
          { key: "kuidacar_provider_report", label: "Relatório local do prestador", detail: "Dados do histórico e faturamento deste mecânico." },
          { key: `hidden_reviews_${user.id}`, label: "Avaliações ocultas do prestador", detail: "Itens ocultados da lista de avaliações deste perfil." },
          { key: "kuidacar_cache_provider_stats", label: "Estatísticas locais do prestador", detail: "Cache de status e métricas do mecânico." },
          { key: "kuidacar_cache_requests", label: "Solicitações em cache", detail: "Dados locais de pedidos e estado do prestador." },
        ]
      : [
          { key: "kuidacar_customer_report", label: "Relatório local do cliente", detail: "Dados do histórico e despesas deste cliente." },
          { key: "kuidacar_cache_requests", label: "Solicitações em cache", detail: "Dados locais de pedidos e estado do cliente." },
          { key: "kuidacar_provider_report", label: "Relatório do prestador em cache", detail: "Registros locais de relatórios relacionados ao prestador." },
        ];

    scopedLocalKeys.forEach(({ key, label, detail }) => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        items.push({
          key,
          label,
          detail,
          source: "localStorage",
          removable: true,
          count: value ? JSON.parse(value).length || 1 : 1,
        });
      }
    });

    try {
      const tableQuery = user.role === "provider"
        ? supabase.from("service_requests").select("id, created_at, customer_id, status").eq("provider_id", user.id)
        : supabase.from("service_requests").select("id, created_at, provider_id, status").eq("customer_id", user.id);

      const { data: services, error: servicesError } = await tableQuery;
      if (!servicesError && services?.length) {
        items.push({
          key: "service_requests",
          label: user.role === "provider" ? "Solicitações relacionadas ao mecânico" : "Solicitações relacionadas ao cliente",
          detail: user.role === "provider" ? `Há ${services.length} serviços vinculados a este prestador.` : `Há ${services.length} serviços vinculados a este cliente.`,
          source: "database",
          removable: false,
          count: services.length,
        });
      }
    } catch (error) {
      console.warn("Não foi possível calcular cache específico do utilizador:", error);
    }

    setCacheItems(items);
  };

  useEffect(() => {
    if (user) {
      buildScopedCacheItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  const clearUserCache = () => {
    try {
      const keys = [
        "kuidacar_provider_report",
        "kuidacar_customer_report",
        `hidden_reviews_${user.id}`,
        "kuidacar_cache_requests",
        "kuidacar_cache_provider_stats",
      ];

      keys.forEach((key) => localStorage.removeItem(key));
      setProviderReportData([]);
      setCustomerReportData([]);
      setCacheItems([]);
      toast.success("Cache limpo com sucesso.");
    } catch (error) {
      console.error("Erro ao limpar cache:", error);
      toast.error("Não foi possível limpar o cache.");
    }
  };

  const renderReportSummary = (rows: any[], kind: "provider" | "customer") => {
    if (!rows.length) {
      return <p className="text-sm text-gray-500">Nenhum dado disponível para este relatório.</p>;
    }

    const totalValue = rows.reduce((sum, row) => sum + Number(row.valor || row.valorTotal || 0), 0);
    const totalCount = rows.reduce((sum, row) => sum + Number(row.atendimentos || row.solicitacoes || 0), 0);

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded border bg-slate-50 p-3">
            <p className="text-gray-500">Total</p>
            <p className="font-semibold">{kind === "provider" ? `${formatMoney(totalValue)}` : `${formatMoney(totalValue)}`}</p>
          </div>
          <div className="rounded border bg-slate-50 p-3">
            <p className="text-gray-500">Registos</p>
            <p className="font-semibold">{totalCount}</p>
          </div>
        </div>

        <div className="max-h-52 overflow-y-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2">Data</th>
                <th className="p-2">Qtd</th>
                <th className="p-2">Valor</th>
                {kind === "provider" ? <th className="p-2">Clientes</th> : <th className="p-2">Estado</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.date}-${index}`} className="border-t">
                  <td className="p-2">{row.date}</td>
                  <td className="p-2">{row.atendimentos || row.solicitacoes || 0}</td>
                  <td className="p-2">{formatMoney(Number(row.valor || row.valorTotal || 0))}</td>
                  {kind === "provider" ? (
                    <td className="p-2">{row.clientes || 0}</td>
                  ) : (
                    <td className="p-2 text-xs">{String(row.status || "-")}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const downloadProviderPdf = () => {
    const lines = [
      "Relatório de prestador",
      `Utilizador: ${user.name}`,
      `E-mail: ${user.email}`,
      "",
      ...providerReportData.map((row) =>
        `${row.date} | Atendimentos: ${row.atendimentos || 0} | Valor: ${formatMoney(Number(row.valor || 0))} | Clientes: ${row.clientes || 0} | Média: ${row.avaliacao || 0}`
      ),
    ];

    downloadReportPdf("relatorio-prestador", lines);
  };

  const downloadCustomerPdf = () => {
    const lines = [
      "Relatório de cliente",
      `Utilizador: ${user.name}`,
      `E-mail: ${user.email}`,
      "",
      ...customerReportData.map((row) =>
        `${row.date} | Solicitações: ${row.solicitacoes || 0} | Valor: ${formatMoney(Number(row.valorTotal || 0))} | Prestadores: ${row.prestadores || 0} | Estado: ${row.status || "-"}`
      ),
    ];

    downloadReportPdf("relatorio-cliente", lines);
  };

  const openSettings = (tab: typeof settingsTab) => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const handleLogout = () => {
    const shouldLogout = window.confirm("Deseja mesmo sair da conta? Isso terminará a sua sessão atual.");
    if (!shouldLogout) return;

    logout();
    toast.success("Sessão encerrada com sucesso!");
    navigate("/", { replace: true });
  };

  const handlePaymentAction = () => {
    if (isProvider) {
      setPaymentModalOpen(true);
      return;
    }

    navigate("/request");
  };

  const isProvider = user.role === "provider";
  const providerDocumentStatus = isProvider
    ? !providerDocumentUrl
      ? "Documento ainda não enviado"
      : "Documento enviado - pendente de revisão"
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-orange-600 text-white p-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(isProvider ? "/provider" : "/request")}
            className="text-white hover:bg-orange-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Meu Perfil</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto p-6">
        {/* Profile Header */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-4">
              <Avatar className="w-24 h-24">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="text-2xl bg-orange-100 text-orange-600">
                  {user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                className="absolute bottom-0 right-0 rounded-full w-8 h-8 bg-orange-600 hover:bg-orange-700"
                onClick={() => toast.info("Função de upload de foto em desenvolvimento")}
              >
                <Camera className="w-4 h-4" />
              </Button>
            </div>

            <h2 className="text-2xl font-semibold mb-1">{user.name}</h2>
            <p className="text-gray-600 mb-3">{user.email}</p>

            <Badge className={isProvider ? "bg-green-600" : "bg-orange-600"}>
              {isProvider ? (
                <>
                  <Wrench className="w-3 h-3 mr-1" />
                  Prestador de Serviço
                </>
              ) : (
                <>
                  <CarIcon className="w-3 h-3 mr-1" />
                  Cliente
                </>
              )}
            </Badge>
          </div>

          {/* Provider Stats */}
          {isProvider && (
            <div className="grid grid-cols-3 gap-4 mb-6 pt-6 border-t">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-yellow-500 mb-1">
                  <Star className="w-4 h-4 fill-yellow-500" />
                  <span className="font-semibold">{user.rating?.toFixed(1)}</span>
                </div>
                <p className="text-xs text-gray-600">Avaliação</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="font-semibold">{user.completedServices}</span>
                </div>
                <p className="text-xs text-gray-600">Serviços</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Wrench className="w-4 h-4 text-orange-600" />
                  <span className="font-semibold text-xs">{user.providerType}</span>
                </div>
                <p className="text-xs text-gray-600">Tipo</p>
              </div>
            </div>
          )}

          {/* Edit Toggle */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? "Cancelar Edição" : "Editar Perfil"}
          </Button>
        </Card>

        {/* Profile Information */}
        <Card className="p-6 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-orange-600" />
            Informações Pessoais
          </h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              {isEditing ? (
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              ) : (
                <p className="p-2 bg-gray-50 rounded border">{user.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                <Mail className="w-4 h-4 text-gray-400" />
                <span>{user.email}</span>
              </div>
              <p className="text-xs text-gray-500">O e-mail não pode ser alterado</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              {isEditing ? (
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              ) : (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{user.phone}</span>
                </div>
              )}
            </div>

            {isProvider && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="vehicleModel">Modelo do Veículo</Label>
                  {isEditing ? (
                    <Input
                      id="vehicleModel"
                      value={formData.vehicleModel}
                      onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded border">{user.vehicleModel}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehiclePlate">Placa do Veículo</Label>
                  {isEditing ? (
                    <Input
                      id="vehiclePlate"
                      value={formData.vehiclePlate}
                      onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value })}
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded border">{user.vehiclePlate}</p>
                  )}
                </div>
              </>
            )}

            {isEditing && (
              <Button
                className="w-full bg-orange-600 hover:bg-orange-700"
                onClick={handleSave}
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </Button>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6 mb-6">
          <h3 className="font-semibold mb-4">Ações Rápidas</h3>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/history")}
            >
              Histórico de Serviços
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handlePaymentAction}
            >
              Métodos de Pagamento
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => openSettings("profile")}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configurações
            </Button>
          </div>
        </Card>

        {/* Logout */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair da Conta
        </Button>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configurações da conta
            </DialogTitle>
            <DialogDescription>
              Ajuste a sua conta, segurança, relatórios e gestão de dados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex flex-wrap gap-2">
              <Button variant={settingsTab === "profile" ? "default" : "outline"} size="sm" onClick={() => setSettingsTab("profile")}>
                <PencilLine className="w-4 h-4 mr-1" />
                Perfil
              </Button>
              <Button variant={settingsTab === "password" ? "default" : "outline"} size="sm" onClick={() => setSettingsTab("password")}>
                <KeyRound className="w-4 h-4 mr-1" />
                Senha
              </Button>
              {(isProvider || user.role === "customer") && (
                <>
                  <Button variant={settingsTab === "terms" ? "default" : "outline"} size="sm" onClick={() => setSettingsTab("terms")}>
                    <FileText className="w-4 h-4 mr-1" />
                    Termos e condições
                  </Button>
                </>
              )}
              {isProvider && (
                <Button variant={settingsTab === "provider-report" ? "default" : "outline"} size="sm" onClick={() => setSettingsTab("provider-report")}>
                  <FileText className="w-4 h-4 mr-1" />
                  Relatório
                </Button>
              )}
              {!isProvider && (
                <Button variant={settingsTab === "customer-report" ? "default" : "outline"} size="sm" onClick={() => setSettingsTab("customer-report")}>
                  <FileText className="w-4 h-4 mr-1" />
                  Relatório
                </Button>
              )}
              <Button variant={settingsTab === "cache" ? "default" : "outline"} size="sm" onClick={() => setSettingsTab("cache")}>
                <Trash2 className="w-4 h-4 mr-1" />
                Cache
              </Button>
            </div>

            {settingsTab === "profile" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Pode alterar os seus dados pessoais aqui.</p>
                <div className="space-y-2">
                  <Label htmlFor="settings-name">Nome completo</Label>
                  <Input id="settings-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-phone">Telefone</Label>
                  <Input id="settings-phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                {isProvider && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="settings-model">Modelo do veículo</Label>
                      <Input id="settings-model" value={formData.vehicleModel} onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="settings-plate">Placa do veículo</Label>
                      <Input id="settings-plate" value={formData.vehiclePlate} onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value })} />
                    </div>
                    <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-orange-700">Documento do prestador</h4>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${providerDocumentUrl ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {providerDocumentStatus}
                        </span>
                      </div>

                      {!providerDocumentUrl ? (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="settings-provider-document-type">Tipo do documento</Label>
                            <select
                              id="settings-provider-document-type"
                              value={providerDocumentType}
                              onChange={(e) => setProviderDocumentType(e.target.value)}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">Selecione o documento</option>
                              <option value="identidade">Identidade</option>
                              <option value="cnh">CNH</option>
                              <option value="carteira_motociclista">Carteira de Motociclista</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="settings-provider-document">Imagem do documento</Label>
                            <Input
                              id="settings-provider-document"
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (!file.type.startsWith("image/")) {
                                  toast.error("Selecione apenas uma imagem válida para o documento.");
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = () => setProviderDocumentUrl(String(reader.result || ""));
                                reader.readAsDataURL(file);
                              }}
                            />
                          </div>

                          {providerDocumentUrl && (
                            <img src={providerDocumentUrl} alt="Documento do prestador" className="h-32 w-full rounded-md border object-cover" />
                          )}

                          <Button
                            className="w-full bg-orange-600 hover:bg-orange-700"
                            onClick={handleSaveProviderDocument}
                            disabled={providerDocumentSaving}
                          >
                            {providerDocumentSaving ? "A enviar..." : "Enviar documento"}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="rounded border border-green-200 bg-white p-3 text-sm text-green-700">
                            Documento já enviado e aguardando revisão do administrador.
                          </div>
                          <img src={providerDocumentUrl} alt="Documento do prestador enviado" className="h-40 w-full rounded-md border object-cover" />
                          <div className="space-y-2">
                            <Label htmlFor="settings-provider-document-type-edit">Tipo do documento</Label>
                            <select
                              id="settings-provider-document-type-edit"
                              value={providerDocumentType}
                              onChange={(e) => setProviderDocumentType(e.target.value)}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">Selecione o documento</option>
                              <option value="identidade">Identidade</option>
                              <option value="cnh">CNH</option>
                              <option value="carteira_motociclista">Carteira de Motociclista</option>
                            </select>
                          </div>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (!file.type.startsWith("image/")) {
                                toast.error("Selecione apenas uma imagem válida para o documento.");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = () => setProviderDocumentUrl(String(reader.result || ""));
                              reader.readAsDataURL(file);
                            }}
                          />
                          <Button
                            className="w-full bg-orange-600 hover:bg-orange-700"
                            onClick={handleSaveProviderDocument}
                            disabled={providerDocumentSaving}
                          >
                            {providerDocumentSaving ? "A atualizar..." : "Atualizar documento"}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            className="w-full"
                            onClick={handleDeleteProviderDocument}
                            disabled={providerDocumentSaving}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar documento guardado
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar alterações
                </Button>
              </div>
            )}

            {settingsTab === "password" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Senha atual</Label>
                  <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
                <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={handleChangePassword} disabled={passwordLoading}>
                  {passwordLoading ? "A alterar..." : "Alterar senha"}
                </Button>
              </div>
            )}

            {settingsTab === "provider-report" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={buildProviderReport} disabled={reportLoading} className="bg-orange-600 hover:bg-orange-700">
                    {reportLoading ? "A gerar..." : "Gerar relatório"}
                  </Button>
                  <Button variant="outline" onClick={downloadProviderPdf} disabled={!providerReportData.length}>
                    <Download className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Relatório vinculado aos clientes atendidos por este mecânico.
                </p>
                {renderReportSummary(providerReportData, "provider")}
              </div>
            )}

            {settingsTab === "customer-report" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={buildCustomerReport} disabled={reportLoading} className="bg-orange-600 hover:bg-orange-700">
                    {reportLoading ? "A gerar..." : "Gerar relatório"}
                  </Button>
                  <Button variant="outline" onClick={downloadCustomerPdf} disabled={!customerReportData.length}>
                    <Download className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Relatório vinculado aos mecânicos que atenderam este cliente.
                </p>
                {renderReportSummary(customerReportData, "customer")}
              </div>
            )}

            {(isProvider || user.role === "customer") && settingsTab === "terms" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-orange-700">
                    Termos e condições do {isProvider ? "mecânico/prestador" : "cliente"}
                  </p>
                  {accountTermsLoading ? (
                    <p className="text-sm text-gray-600">A carregar termos...</p>
                  ) : accountTermsError ? (
                    <p className="text-sm text-red-700">{accountTermsError}</p>
                  ) : (
                    <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-gray-800">
                      <h3 className="mb-2 font-semibold">Termos e condições</h3>
                      {accountTerms}
                      <h3 className="mb-2 mt-5 font-semibold">Aviso de privacidade</h3>
                      {accountPrivacyNotice}
                    </div>
                  )}
                </div>
                <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={() => setSettingsOpen(false)}>
                  Fechar
                </Button>
              </div>
            )}

            {settingsTab === "cache" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Estes são os dados locais e relacionados ao perfil atual que podem ser eliminados para este {user.role === "provider" ? "mecânico" : "cliente"}.
                </p>
                {cacheItems.length === 0 ? (
                  <div className="rounded border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                    Nenhum dado local removível encontrado para este perfil.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cacheItems.map((item) => (
                      <div key={item.key} className="rounded border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-gray-800">{item.label}</p>
                          {item.removable && (
                            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                              Local
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-gray-600">{item.detail}</p>
                        <p className="mt-2 text-xs text-gray-500">
                          {item.source === "database" ? `Registos: ${item.count}` : `Itens: ${item.count}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="destructive" onClick={clearUserCache} className="w-full">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpar cache
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Pagamento {selectedPaymentMethod === "iban" ? "por IBAN" : "Multicaixa Express"}
            </DialogTitle>
            <DialogDescription>
              {selectedPaymentMethod === "iban"
                ? "Faça a transferência para o IBAN abaixo e envie a referência e o valor para o administrador confirmar."
                : "Pague no Multicaixa utilizando o número abaixo e envie a referência para o administrador confirmar."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={selectedPaymentMethod === "multicaixa" ? "default" : "outline"}
                onClick={() => setSelectedPaymentMethod("multicaixa")}
              >
                Multicaixa Express
              </Button>
              <Button
                type="button"
                variant={selectedPaymentMethod === "iban" ? "default" : "outline"}
                onClick={() => setSelectedPaymentMethod("iban")}
              >
                IBAN
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-payment-destination">
                  {selectedPaymentMethod === "iban" ? "IBAN" : "Número Multicaixa"}
                </Label>
                <Input
                  id="profile-payment-destination"
                  value={selectedPaymentMethod === "iban" ? paymentIban : paymentNumber}
                  readOnly
                  placeholder={selectedPaymentMethod === "iban" ? "IBAN não configurado" : "929630902"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`profile-payment-amount-${selectedPaymentMethod}`}>Valor pago</Label>
                <Input
                  id={`profile-payment-amount-${selectedPaymentMethod}`}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Ex: 100.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`profile-payment-reference-${selectedPaymentMethod}`}>Referência</Label>
              <Input
                id={`profile-payment-reference-${selectedPaymentMethod}`}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={`Informe a referência ${selectedPaymentMethod === "iban" ? "da transferência IBAN" : "do Multicaixa"}`}
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              Fechar
            </Button>
            <Button
              onClick={async () => {
                if (!user) return;
                if (!paymentReference.trim()) {
                  toast.error("Informe a referência do pagamento.");
                  return;
                }

                const parsedAmount = Number.parseFloat(String(paymentAmount || "").replace(",", "."));
                if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
                  toast.error("Informe um valor de pagamento válido.");
                  return;
                }

                try {
                  const requestId = `profile-payment-${Date.now()}`;
                  await apiClient.submitPaymentReference(
                    requestId,
                    paymentReference.trim(),
                    parsedAmount,
                    user.id,
                    selectedPaymentMethod,
                  );
                  toast.success("Referência enviada. O administrador irá confirmar em breve.");
                  setPaymentReference("");
                  setPaymentAmount("");
                  setPaymentModalOpen(false);
                } catch (error: any) {
                  console.error("Erro ao enviar referência de pagamento:", error);
                  toast.error(error?.message || "Não foi possível enviar a referência.");
                }
              }}
            >
              Enviar referência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}