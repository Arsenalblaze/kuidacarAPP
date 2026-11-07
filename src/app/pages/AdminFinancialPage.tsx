import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { apiClient } from "../utils/api";
import { parseCustomPaymentList, parsePaymentReport, type ParsedCustomPaymentEntry } from "../utils/PaymentParser";
import { matchParsedPayments, type MatchedPaymentResult, type PaymentReferenceRecord } from "../utils/PaymentMatcher";
import { toast } from "sonner";
import { DollarSign, Loader2, Search, Download } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";

interface PaymentReference {
  id: string;
  requestId: string;
  reference: string;
  amount: number;
  userId: string;
  paymentMethod?: string;
  status: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  mechanicName?: string;
  debt?: number | null;
}

const statusOptions = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendentes" },
  { value: "approved", label: "Aprovadas" },
  { value: "partial", label: "Parciais" },
  { value: "reimbursed", label: "Reembolsadas" },
] as const;

const parsedPreviewStatusOptions = [
  { value: "all", label: "Todos" },
  { value: "complete", label: "Pagamentos completos" },
  { value: "partial", label: "Parciais" },
  { value: "overpay", label: "Excedentes" },
  { value: "not_found", label: "Não encontrados" },
] as const;

type ParsedPreviewFilter = typeof parsedPreviewStatusOptions[number]["value"];
type ConfirmationMode = "bank_report" | "custom";

interface CustomPaymentRow extends ParsedCustomPaymentEntry {
  matchedReference?: PaymentReference;
  amountMatches: boolean;
  processed?: boolean;
}

type StatusFilter = typeof statusOptions[number]["value"];
type PaymentMethodFilter = "all" | "iban" | "multicaixa";

const normalizeReferenceListValue = (value: string) =>
  value.trim().replace(/\s*\|\s*\d+(?:[.,]\d+)?$/g, '').replace(/\s+/g, ' ').trim();

export const AdminFinancialPage = () => {
  const [references, setReferences] = useState<PaymentReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>("all");
  const [bankReportInput, setBankReportInput] = useState("");
  const [parsedPayments, setParsedPayments] = useState<MatchedPaymentResult[]>([]);
  const [adminAmounts, setAdminAmounts] = useState<Record<string, number>>({});
  const [parsedFilter, setParsedFilter] = useState<ParsedPreviewFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [referencesSearch, setReferencesSearch] = useState("");
  const [referenceListSearch, setReferenceListSearch] = useState("");
  const [referenceListSearchEnabled, setReferenceListSearchEnabled] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseStatus, setParseStatus] = useState("");
  const [parsingReport, setParsingReport] = useState(false);
  const [confirmingPayments, setConfirmingPayments] = useState(false);
  const [confirmationMode, setConfirmationMode] = useState<ConfirmationMode>("bank_report");
  const [customPayments, setCustomPayments] = useState<CustomPaymentRow[]>([]);
  const [selectedCustomPayments, setSelectedCustomPayments] = useState<Record<string, boolean>>({});
  const [providerCredits, setProviderCredits] = useState<Array<{ providerId: string; name: string; amount: number }>>([]);

  useEffect(() => {
    loadPaymentReferences();
    loadProviderCredits();
  }, []);

  const loadProviderCredits = async () => {
    try {
      const response = await apiClient.getProviderCredits();
      if (!response.success) {
        throw new Error(response.error || "Não foi possível carregar os saldos positivos.");
      }
      setProviderCredits(response.credits || []);
    } catch (error: any) {
      console.error("Erro ao carregar saldos positivos:", error);
      toast.error(error?.message || "Não foi possível carregar os saldos positivos.");
    }
  };

  const loadPaymentReferences = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPaymentReferences();

      if (!response.success) {
        throw new Error("Não foi possível carregar referências de pagamento.");
      }

      const enriched = await Promise.all(
        (response.references || []).map(async (item: any) => {
          const userResponse = await apiClient.getUserById(item.userId);
          return {
            id: item.id,
            requestId: item.requestId || item.id,
            reference: item.reference || "-",
            amount: item.amount || 0,
            userId: item.userId || "-",
            paymentMethod: item.paymentMethod || "multicaixa",
            status: item.status || "pending",
            note: item.note || "",
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            mechanicName: userResponse?.user?.name || item.userId || "-",
          };
        })
      );

      setReferences(enriched);
    } catch (error: any) {
      console.error("Erro ao carregar referências de pagamento:", error);
      toast.error(error?.message || "Erro ao carregar referências de pagamento.");
      setReferences([]);
    } finally {
      setLoading(false);
    }
  };


  const toReferenceRecords = (items: PaymentReference[]): PaymentReferenceRecord[] =>
    items.map((item) => ({
      id: item.id,
      requestId: item.requestId,
      reference: String(item.reference).trim(),
      amount: item.amount,
      userId: item.userId,
      status: item.status,
      mechanicName: item.mechanicName,
      note: item.note,
    }));

  const handleAnalyzeBankReport = async () => {
    if (!bankReportInput.trim()) {
      toast.error('Cole o relatório de pagamentos recebido antes de analisar.');
      return;
    }

    setParsingReport(true);
    setParseProgress(0);
    setParseStatus('Iniciando análise...');

    try {
      if (confirmationMode === "custom") {
        const parsedCustom = parseCustomPaymentList(bankReportInput);
        const referenceMap = new Map(
          references.map((reference) => [reference.reference.trim().toLowerCase(), reference]),
        );
        const customRows = parsedCustom.map((item) => {
          const matchedReference = referenceMap.get(item.reference.trim().toLowerCase());
          return {
            ...item,
            matchedReference,
            amountMatches: Boolean(
              matchedReference &&
              Math.round(Number(matchedReference.amount || 0)) === Math.round(item.amountPaid),
            ),
          };
        });
        setCustomPayments(customRows);
        setSelectedCustomPayments({});
        setParsedPayments([]);
        setParseProgress(100);
        setParseStatus("Lista personalizada analisada");
        const eligibleCount = customRows.filter((item) => item.matchedReference).length;
        toast.success(`${customRows.length} linha(s) analisada(s); ${eligibleCount} pronta(s) para confirmação.`);
        return;
      }

      const parsed = await parsePaymentReport(bankReportInput, (progress, status) => {
        setParseProgress(progress);
        setParseStatus(status);
      });

      const results = matchParsedPayments(parsed, toReferenceRecords(references));

      setParsedPayments(results);
      setParseProgress(100);
      setParseStatus('Análise concluída');
      toast.success(`${results.length} referências analisadas.`);
    } catch (error: any) {
      console.error('Erro ao analisar relatório bancário:', error);
      toast.error(error?.message || 'Erro ao analisar relatório bancário.');
      setParseStatus('Falha na análise');
    } finally {
      setParsingReport(false);
    }
  };

  const handleClearBankReport = () => {
    setBankReportInput('');
    setParsedPayments([]);
    setSearchQuery('');
    setParsedFilter('all');
    setParseProgress(0);
    setParseStatus('');
    setCustomPayments([]);
    setSelectedCustomPayments({});
  };

  const handleSaveLocalReferenceList = async () => {
    const sourceText = bankReportInput.trim();
    const list = sourceText
      ? sourceText
          .split(/\r?\n|,|;/)
          .map((entry) => normalizeReferenceListValue(entry))
          .filter(Boolean)
      : parsedPayments
          .map((item) => normalizeReferenceListValue(item.reference))
          .filter(Boolean);

    if (list.length === 0) {
      toast.error('Nenhuma referência encontrada para salvar no banco.');
      return;
    }

    try {
      const uniqueList = [...new Set(list)];
      const response = await apiClient.savePaymentReferenceList(uniqueList);
      if (!response.success) {
        throw new Error('Não foi possível guardar a lista de referências.');
      }

      toast.success(`${(response.list || uniqueList).length} referência(s) salva(s) no banco.`);
    } catch (error: any) {
      console.error('Erro ao salvar lista de referências:', error);
      toast.error(error?.message || 'Erro ao salvar lista de referências.');
    }
  };

  const handleViewSavedReferenceList = async () => {
    try {
      const response = await apiClient.getSavedPaymentReferenceList();
      const saved = response.list || [];

      if (saved.length === 0) {
        toast.error('Nenhuma lista salva foi encontrada no banco.');
        return;
      }

      const nextText = saved.join('\n');
      setBankReportInput(nextText);
      toast.success(`${saved.length} referência(s) carregada(s) da lista salva.`);
    } catch (error: any) {
      console.error('Erro ao carregar lista salva:', error);
      toast.error(error?.message || 'Erro ao carregar lista salva.');
    }
  };

  const handleClearSavedReferenceList = async () => {
    try {
      const response = await apiClient.clearSavedPaymentReferenceList();
      if (!response.success) {
        throw new Error('Não foi possível limpar a lista salva.');
      }
      setBankReportInput('');
      toast.success('Lista salva de referências removida.');
    } catch (error: any) {
      console.error('Erro ao limpar lista salva:', error);
      toast.error(error?.message || 'Erro ao limpar lista salva.');
    }
  };

  const handleVerifyReferenceList = async () => {
    const savedResponse = await apiClient.getSavedPaymentReferenceList();
    const saved = savedResponse.list || [];
    const detected = parsedPayments.map((item) => normalizeReferenceListValue(item.reference));

    if (saved.length === 0) {
      toast.error('Salve primeiro uma lista para comprovar as referências.');
      return;
    }

    const matched = [...new Set(saved.filter((ref) => detected.includes(ref)))];
    const missing = saved.filter((ref) => !detected.includes(ref));

    if (matched.length === 0) {
      toast.error(`Nenhuma referência da lista foi encontrada no relatório analisado. ${missing.length} ausente(s).`);
      return;
    }

    try {
      let confirmedCount = 0;

      for (const reference of matched) {
        const response = await apiClient.approvePaymentReferencesMatchingAdminList([reference]);
        if (response.success) {
          confirmedCount += Number(response.approvedCount || 0);
        }
      }

      if (confirmedCount === 0) {
        throw new Error('Nenhuma referência foi confirmada no sistema.');
      }

      await loadPaymentReferences();
      toast.success(
        `Comprovação concluída: ${confirmedCount} referência(s) confirmada(s) imediatamente e ${missing.length} ausente(s).`
      );

      setBankReportInput([...new Set([...saved, ...detected])].join('\n'));
    } catch (error: any) {
      console.error('Erro ao comprovar referências da lista:', error);
      toast.error(error?.message || 'Erro ao confirmar referências encontradas.');
    }
  };

  const filteredParsedPayments = useMemo(() => {
    return parsedPayments.filter((item) => {
      const matchesStatus = parsedFilter === 'all' || item.resultType === parsedFilter;
      const matchesSearch = searchQuery
        ? item.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(item.requestId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(item.mechanicName || '').toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      return matchesStatus && matchesSearch;
    });
  }, [parsedPayments, parsedFilter, searchQuery]);

  const downloadParsedPaymentsCsv = () => {
    const rows = filteredParsedPayments;
    const header = ['Referência', 'Valor', 'Estado', 'Pedido', 'Mecânico', 'Mensagem'];
    const csv = [header.join(',')].concat(
      rows.map((item) => [
        item.reference,
        item.amountPaid,
        item.statusLabel,
        item.requestId || '',
        item.mechanicName || '',
        item.message.replace(/\n/g, ' '),
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'parsed_payments.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfirmParsedPayments = async () => {
    if (parsedPayments.length === 0) {
      toast.error('Nenhuma referência analisada para confirmar.');
      return;
    }

    setConfirmingPayments(true);

    try {
      const approvals = parsedPayments.map(async (item) => {
        if (!item.matchedReference) {
          return { success: false, reference: item.reference, reason: 'not_found' };
        }

        const requestId = item.matchedReference.requestId || String(item.matchedReference.id || '').replace(/^payment_ref:/, '');
        const adminAmount = typeof adminAmounts[item.reference] === 'number' ? adminAmounts[item.reference] : item.amountPaid;
        const updates: any = {
          paymentReference: item.reference,
          paymentAmount: adminAmount,
        };

        if (item.resultType === 'complete' || item.resultType === 'overpay') {
          updates.status = 'paid';
          updates.amount_due = 0;
          updates.paid_at = new Date().toISOString();
        } else if (item.resultType === 'partial') {
          updates.status = 'partial';
          updates.amount_due = item.amountDue;
          updates.paid_at = new Date().toISOString();
        }

        try {
        if (requestId) {
            await apiClient.updateServiceRequest(requestId, updates);
            // Mark as approved and confirmed by admin so debt is reduced only on admin confirmation
            // Pass admin-adjusted amount so debt is adjusted accordingly
            await apiClient.updatePaymentReferenceStatus(requestId, 'approved', item.statusLabel, true, adminAmount);
          }

          const notificationMessage = item.message;
          await apiClient.createNotification({
            userId: item.matchedReference.userId,
            requestId: item.matchedReference.requestId,
            type: 'payment_confirmed',
            title: item.statusLabel,
            message: notificationMessage,
          });

          return { success: true, reference: item.reference };
        } catch (error: any) {
          console.error('Erro ao confirmar pagamento para referência', item.reference, error);
          return { success: false, reference: item.reference, reason: error?.message || 'update_failed' };
        }
      });

      const results = await Promise.all(approvals);
      const confirmedCount = results.filter((item) => item.success).length;
      const notFoundCount = results.filter((item) => item.reason === 'not_found').length;

      toast.success(`${confirmedCount} pagamentos confirmados. ${notFoundCount} referências não encontradas.`);
      await loadPaymentReferences();
      const updateMap = new Map(results.map((item) => [item.reference, item.success]));
      setParsedPayments(parsedPayments.map((item) => ({
        ...item,
        statusLabel: updateMap.get(item.reference) ? 'Confirmado' : item.statusLabel,
        message: updateMap.get(item.reference) ? 'Pagamento processado.' : item.message,
      })));
    } catch (error: any) {
      console.error('Erro ao confirmar pagamentos analisados:', error);
      toast.error(error?.message || 'Erro ao confirmar pagamentos analisados.');
    } finally {
      setConfirmingPayments(false);
    }
  };

  const visibleReferences = useMemo(
    () => {
      const q = String(referencesSearch || "").trim().toLowerCase();
      const listTerms = referenceListSearchEnabled
        ? String(referenceListSearch || "")
            .split(/[\n,;]+/)
            .map((value) => normalizeReferenceListValue(value).toLowerCase())
            .filter(Boolean)
        : [];

      return references.filter((reference) => {
        const matchesStatus = statusFilter === "all" || reference.status === statusFilter;
        const matchesPaymentMethod =
          paymentMethodFilter === "all" ||
          (reference.paymentMethod || "multicaixa") === paymentMethodFilter;

        const referenceText = String(reference.reference || "").toLowerCase();
        const mechanicText = String(reference.mechanicName || "").toLowerCase();
        const requestText = String(reference.requestId || "").toLowerCase();

        const matchesQuery = !q ||
          referenceText.includes(q) ||
          mechanicText.includes(q) ||
          requestText.includes(q);

        const matchesReferenceList =
          listTerms.length === 0 ||
          listTerms.some((term) =>
            referenceText.includes(term) ||
            term.includes(referenceText) ||
            mechanicText.includes(term) ||
            requestText.includes(term));

        return matchesStatus && matchesPaymentMethod && matchesQuery && matchesReferenceList;
      });
    },
    [references, statusFilter, paymentMethodFilter, referencesSearch, referenceListSearchEnabled, referenceListSearch]
  );

  const [selectedReferences, setSelectedReferences] = useState<Record<string, boolean>>({});

  const customConfirmableRows = customPayments.filter(
    (item) => item.matchedReference && !item.processed,
  );
  const customPaymentKey = (item: CustomPaymentRow) =>
    `${item.reference.toLowerCase()}:${item.lineIndex}`;
  const selectedCustomCount = Object.values(selectedCustomPayments).filter(Boolean).length;
  const allVisibleSelected = confirmationMode === "custom"
    ? customConfirmableRows.length > 0 &&
      customConfirmableRows.every((item) => Boolean(selectedCustomPayments[customPaymentKey(item)]))
    : visibleReferences.length > 0 && visibleReferences.every((r) => !!selectedReferences[r.id]);

  const toggleSelectAll = (checked: boolean) => {
    if (confirmationMode === "custom") {
      if (checked) {
        setSelectedCustomPayments(Object.fromEntries(
          customConfirmableRows.map((item) => [customPaymentKey(item), true]),
        ));
      } else {
        setSelectedCustomPayments({});
      }
      return;
    }

    if (checked) {
      const map: Record<string, boolean> = {};
      visibleReferences.forEach((r) => (map[r.id] = true));
      setSelectedReferences(map);
    } else {
      setSelectedReferences((prev) => {
        const next = { ...prev };
        visibleReferences.forEach((r) => delete next[r.id]);
        return next;
      });
    }
  };

  const toggleReferenceSelection = (id: string, checked: boolean) => {
    setSelectedReferences((prev) => ({ ...prev, [id]: checked }));
  };

  const handleConfirmSelectedReferences = async () => {
    if (confirmationMode === "custom") {
      const selectedRows = customConfirmableRows.filter(
        (item) => selectedCustomPayments[customPaymentKey(item)],
      );
      if (selectedRows.length === 0) {
        toast.error("Selecione pelo menos uma linha válida da lista personalizada.");
        return;
      }

      setConfirmingPayments(true);
      let confirmedCount = 0;
      const processedKeys: string[] = [];
      try {
        for (const item of selectedRows) {
          const matched = item.matchedReference;
          if (!matched) continue;

          try {
            const result = await apiClient.applyCustomPaymentToProviderDebt(
              matched.userId,
              matched.requestId,
              item.amountPaid,
            );
            if (!result.success) {
              throw new Error("O pagamento não foi aplicado.");
            }

            confirmedCount += 1;
            processedKeys.push(customPaymentKey(item));
            await apiClient.createNotification({
              userId: matched.userId,
              requestId: matched.requestId,
              type: "payment_confirmed",
              title: "Pagamento confirmado",
              message: `O pagamento de ${formatCurrency(item.amountPaid)} pela referência ${item.reference} foi confirmado. Dívida restante: ${formatCurrency(result.debt)}. Saldo positivo: ${formatCurrency(result.creditBalance)}.`,
            }).catch((error) => console.warn("Pagamento confirmado, mas a notificação ao mecânico falhou:", error));
          } catch (error: any) {
            console.error(`Erro ao aplicar pagamento da referência ${item.reference}:`, error);
            toast.error(`${item.reference}: ${error?.message || "não foi possível confirmar."}`);
          }
        }

        setCustomPayments((previous) => previous.map((item) =>
          processedKeys.includes(customPaymentKey(item)) ? { ...item, processed: true } : item,
        ));
        setSelectedCustomPayments({});
        if (confirmedCount > 0) {
          toast.success(`${confirmedCount} pagamento(s) personalizado(s) confirmado(s).`);
          await Promise.all([loadPaymentReferences(), loadProviderCredits()]);
        }
      } finally {
        setConfirmingPayments(false);
      }
      return;
    }

    const selectedIds = Object.entries(selectedReferences)
      .filter(([, isSelected]) => Boolean(isSelected))
      .map(([id]) => id);

    if (selectedIds.length === 0) {
      toast.error('Selecione pelo menos uma referência para confirmar.');
      return;
    }

    setConfirmingPayments(true);

    try {
      const selectedItems = visibleReferences.filter((reference) => selectedIds.includes(reference.id));

      for (const reference of selectedItems) {
        const amountToApply = typeof adminAmounts[reference.requestId] === 'number'
          ? adminAmounts[reference.requestId]
          : typeof adminAmounts[reference.id] === 'number'
            ? adminAmounts[reference.id]
            : Number(reference.amount || 0);

        await apiClient.updatePaymentReferenceStatus(
          reference.requestId,
          'approved',
          'Confirmado pelo admin',
          true,
          amountToApply
        );
      }

      toast.success(`${selectedItems.length} pagamento(s) confirmado(s) com sucesso.`);
      setSelectedReferences({});
      await loadPaymentReferences();
    } catch (error: any) {
      console.error('Erro ao confirmar referências selecionadas:', error);
      toast.error(error?.message || 'Erro ao confirmar referências selecionadas.');
    } finally {
      setConfirmingPayments(false);
    }
  };

  const handleRemoveProviderCredit = async (credit: { providerId: string; name: string; amount: number }) => {
    if (!window.confirm(`Remover o saldo positivo de ${credit.name} (${formatCurrency(credit.amount)})?`)) return;
    const response = await apiClient.clearProviderCredit(credit.providerId);
    if (!response.success) {
      toast.error(response.error || "Não foi possível remover o saldo positivo.");
      return;
    }
    toast.success(`Saldo positivo de ${credit.name} removido.`);
    await loadProviderCredits();
  };

  const totals = useMemo(
    () => ({
      total: references.length,
      pending: references.filter((item) => item.status === "pending").length,
      approved: references.filter((item) => item.status === "approved").length,
      rejected: references.filter((item) => item.status === "rejected").length,
      reimbursed: references.filter((item) => item.status === "reimbursed").length,
    }),
    [references]
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-AO", {
      style: "currency",
      currency: "AOA",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0);

  const formatDate = (value?: string) =>
    value
      ? new Date(value).toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "-";

  return (
    <AdminLayout title="Financeiro" subtitle="Gerenciar pagamentos e comissões">
      <div className="space-y-6">
        {/* Admin payment references block removed as requested */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-blue-500/10 border-blue-500/20 p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-blue-400" />
              <div>
                <p className="text-slate-400 text-sm">Referências cadastradas</p>
                <p className="text-2xl font-bold text-white">{totals.total}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-orange-500/10 border-orange-500/20 p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-orange-400" />
              <div>
                <p className="text-slate-400 text-sm">Pendentes</p>
                <p className="text-2xl font-bold text-white">{totals.pending}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-emerald-500/10 border-emerald-500/20 p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              <div>
                <p className="text-slate-400 text-sm">Aprovadas</p>
                <p className="text-2xl font-bold text-white">{totals.approved}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-slate-300" />
              <div>
                <p className="text-slate-400 text-sm">Rejeitadas / Reembolsadas</p>
                <p className="text-2xl font-bold text-white">{totals.rejected + totals.reimbursed}</p>
              </div>
            </div>
          </Card>
        </div>

        {providerCredits.length > 0 && (
          <Card className="border-slate-700 p-6">
            <h2 className="mb-3 text-sm font-semibold text-white">Saldos positivos dos mecânicos</h2>
            <div className="space-y-2">
              {providerCredits.map((credit) => (
                <div key={credit.providerId} className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-800 bg-slate-950/70 p-3">
                  <div>
                    <p className="font-medium text-white">{credit.name}</p>
                    <p className="text-sm text-slate-400">{formatCurrency(credit.amount)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { void handleRemoveProviderCredit(credit); }}
                  >
                    Remover saldo
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="border-slate-700 p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Referências enviadas pelos mecânicos</p>
              <p className="text-slate-400 text-sm">Dados carregados da tabela de chaves do banco de dados.</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {statusOptions.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={statusFilter === option.value ? "default" : "outline"}
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
              {([
                { value: "all", label: "Todos os métodos" },
                { value: "multicaixa", label: "Só Express" },
                { value: "iban", label: "Só IBAN" },
              ] as const).map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={paymentMethodFilter === option.value ? "default" : "outline"}
                  onClick={() => setPaymentMethodFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
              <Button size="sm" variant="destructive" onClick={async () => {
                if (!window.confirm('Deseja eliminar todas as referências de pagamento? Esta ação é irreversível.')) return;
                try {
                  await apiClient.deleteAllPaymentReferences();
                  toast.success('Todas as referências foram eliminadas.');
                  await loadPaymentReferences();
                } catch (err: any) {
                  console.error('Erro ao eliminar todas referências:', err);
                  toast.error(err?.message || 'Erro ao eliminar referências.');
                }
              }}>
                Eliminar todas
              </Button>
            </div>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={confirmationMode === "bank_report" ? "default" : "outline"}
                  onClick={() => {
                    setConfirmationMode("bank_report");
                    setSelectedCustomPayments({});
                  }}
                >
                  Relatório bancário
                </Button>
                <Button
                  size="sm"
                  variant={confirmationMode === "custom" ? "default" : "outline"}
                  onClick={() => {
                    setConfirmationMode("custom");
                    setParsedPayments([]);
                    setSelectedReferences({});
                  }}
                >
                  Personalizado
                </Button>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {confirmationMode === "custom" ? "Confirmação personalizada de pagamentos" : "Relatório do banco / Multicaixa Express"}
                </p>
                <p className="text-slate-400 text-sm">
                  {confirmationMode === "custom"
                    ? "Cole linhas com referência e valor. O sistema usa a referência para localizar o mecânico e exige que o valor coincida com o registado. O estado colado é apenas informativo."
                    : "Cole aqui o relatório completo. O sistema detecta referências e valores automaticamente."}
                </p>
              </div>

              <Textarea
                value={bankReportInput}
                onChange={(event) => setBankReportInput(event.target.value)}
                placeholder={
                  confirmationMode === "custom"
                    ? "002\tMaria José\tIBAN\tTRF-00981\t10.000 Kz\tPendente\n003\tPaulo António\tIBAN\tTRF-00982\t10.000 Kz\tConfirmado\n004\tAna Miguel\tMulticaixa Express\tMCX-10248\t10.000 Kz\tRejeitado"
                    : 'Exemplos suportados:\nABC12345 5000\n250123456789 5000\n250123456790 - 3500\nRef:250123456791 Valor:10000\n250123456792,8000\n250123456793\nValor:4500\nOu qualquer texto com referência e valor.'
                }
                className="min-h-[260px] bg-slate-900/80 text-white"
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-400">
                  Referências detectadas: {confirmationMode === "custom" ? customPayments.length : parsedPayments.length}
                </div>
                <div className="flex flex-wrap gap-2">
                  {confirmationMode === "bank_report" && (
                    <>
                      <Button size="sm" variant="outline" onClick={handleSaveLocalReferenceList}>Salvar lista</Button>
                      <Button size="sm" variant="outline" onClick={handleViewSavedReferenceList}>Ver lista salva</Button>
                      <Button size="sm" variant="destructive" onClick={handleClearSavedReferenceList}>Eliminar lista</Button>
                      <Button size="sm" variant="outline" onClick={handleVerifyReferenceList}>Comprovar</Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearBankReport}
                  >
                    Limpar
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleAnalyzeBankReport}
                    disabled={parsingReport || !bankReportInput.trim()}
                  >
                    {parsingReport ? 'Analisando...' : 'Analisar Pagamentos'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
              <p className="text-sm font-semibold text-white">Pré-visualização</p>
              <p className="text-slate-400 text-sm">Revise o resultado antes de confirmar.</p>
              {confirmationMode === "custom" ? (
                <div className="space-y-3">
                  <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
                    <div className="rounded border border-slate-800 bg-slate-900 p-2">Linhas: {customPayments.length}</div>
                    <div className="rounded border border-slate-800 bg-slate-900 p-2">Correspondências válidas: {customConfirmableRows.length}</div>
                    <div className="rounded border border-slate-800 bg-slate-900 p-2">Selecionadas: {selectedCustomCount}</div>
                  </div>
                  {customPayments.length === 0 ? (
                    <p className="rounded border border-slate-800 bg-slate-900 p-3 text-sm text-slate-400">
                      Analise a lista para validar referências e valores.
                    </p>
                  ) : (
                    <div className="max-h-[420px] space-y-2 overflow-y-auto">
                      {customPayments.map((item) => {
                        const key = customPaymentKey(item);
                        const canConfirm = Boolean(item.matchedReference && !item.processed);
                        return (
                          <div key={key} className="flex items-start gap-3 rounded border border-slate-800 bg-slate-900 p-3">
                            <Checkbox
                              checked={Boolean(selectedCustomPayments[key])}
                              disabled={!canConfirm}
                              onCheckedChange={(checked: any) =>
                                setSelectedCustomPayments((previous) => ({ ...previous, [key]: Boolean(checked) }))
                              }
                            />
                            <div className="min-w-0 flex-1 text-sm">
                              <div className="flex flex-wrap justify-between gap-2">
                                <span className="break-all font-semibold text-white">{item.reference}</span>
                                <span className="font-semibold text-white">{formatCurrency(item.amountPaid)}</span>
                              </div>
                              <p className="mt-1 text-slate-400">
                                Mecânico: {item.matchedReference?.mechanicName || "Não encontrado"}
                                {item.matchedReference ? ` · Estado na lista: ${item.pastedStatus || "não indicado"}` : ""}
                              </p>
                              <p className={`mt-1 ${canConfirm ? "text-emerald-400" : "text-amber-400"}`}>
                                {item.processed
                                  ? "Pagamento já processado nesta lista"
                                  : !item.matchedReference
                                    ? "Referência não encontrada no sistema"
                                    : !item.amountMatches
                                      ? `${item.amountPaid < Number(item.matchedReference.amount)
                                        ? "Valor inferior"
                                        : "Valor superior"} ao registado (${formatCurrency(item.matchedReference.amount)}); será aplicado à dívida/saldo positivo`
                                      : "Referência e valor correspondem; pronta para confirmar"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <>
              <div className="space-y-4 text-sm text-slate-300">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
                    Total analisadas: {parsedPayments.length}
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
                    Progresso: {parseProgress}%
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-emerald-400 transition-all duration-300" style={{ width: `${parseProgress}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{parseStatus}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
                    Pagamentos completos: {parsedPayments.filter((item) => item.resultType === 'complete').length}
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
                    Pagamentos parciais: {parsedPayments.filter((item) => item.resultType === 'partial').length}
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
                    Pagamentos com excedente: {parsedPayments.filter((item) => item.resultType === 'overpay').length}
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
                    Referências não encontradas: {parsedPayments.filter((item) => item.resultType === 'not_found').length}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Pesquisar por referência, pedido ou mecânico"
                      className="bg-slate-900/80 text-white"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parsedPreviewStatusOptions.map((option) => (
                      <Button
                        key={option.value}
                        size="sm"
                        variant={parsedFilter === option.value ? 'default' : 'outline'}
                        onClick={() => setParsedFilter(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="inline-flex items-center gap-2"
                  onClick={downloadParsedPaymentsCsv}
                  disabled={filteredParsedPayments.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </Button>
              </div>

              {filteredParsedPayments.length > 0 ? (
                <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/80 p-4 text-sm text-slate-300">
                  <div className="text-slate-300 font-semibold">Detalhes da análise</div>
                  <div className="grid gap-3">
                    {filteredParsedPayments.map((item) => (
                      <div key={`${item.reference}-${item.amountPaid}`} className="rounded-md border border-slate-800 bg-slate-900/80 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Referência</p>
                            <p className="text-sm text-white break-all">{item.reference}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Valor</p>
                            <p className="text-sm text-white">{item.amountPaid.toLocaleString()} Kz</p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-slate-500">Estado</p>
                            <p className="text-sm text-white">{item.statusLabel}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Pedido associado</p>
                            <p className="text-sm text-white">{item.requestId || 'Não encontrado'}</p>
                          </div>
                        </div>
                        <div className="mt-3 text-slate-400">{item.message}</div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 items-end">
                          <div>
                            <p className="text-xs text-slate-500">Valor detectado</p>
                            <p className="text-sm text-white">{item.amountPaid.toLocaleString()} Kz</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Valor (o administrador pode ajustar)</p>
                            <Input
                              value={(adminAmounts[item.reference] ?? item.amountPaid).toString()}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value.replace(',', '.')) || 0;
                                setAdminAmounts((prev) => ({ ...prev, [item.reference]: v }));
                              }}
                              className="bg-slate-900/80 text-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <Button
                size="sm"
                variant="secondary"
                onClick={handleConfirmParsedPayments}
                disabled={
                  confirmingPayments || parsedPayments.length === 0 ||
                  parsedPayments.every((item) => !item.matchedReference)
                }
              >
                {confirmingPayments ? 'Confirmando pagamentos...' : 'Confirmar Pagamentos'}
              </Button>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-400">
              {confirmationMode === "custom" ? selectedCustomCount : Object.values(selectedReferences).filter(Boolean).length} selecionados
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={handleConfirmSelectedReferences}
                disabled={confirmingPayments || (
                  confirmationMode === "custom"
                    ? selectedCustomCount === 0
                    : Object.values(selectedReferences).every((value) => !value)
                )}
              >
                {confirmingPayments
                  ? 'Confirmando selecionados...'
                  : confirmationMode === "custom"
                    ? 'Confirmar pagamentos personalizados'
                    : 'Confirmar selecionados'}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.7fr_auto] lg:items-center">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={referencesSearch}
                onChange={(event) => setReferencesSearch(event.target.value)}
                placeholder="Pesquisar referência, pedido ou mecânico"
                className="pl-10 bg-slate-900/80 text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={referenceListSearch}
                  onChange={(event) => setReferenceListSearch(event.target.value)}
                  placeholder="Pesquisar várias referências"
                  className="pl-10 bg-slate-900/80 text-white"
                  disabled={!referenceListSearchEnabled}
                />
              </div>
              <Button
                size="sm"
                variant={referenceListSearchEnabled ? "default" : "outline"}
                onClick={() => setReferenceListSearchEnabled((prev) => !prev)}
              >
                {referenceListSearchEnabled ? 'Pesquisa ativa' : 'Pesquisar várias'}
              </Button>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Checkbox checked={allVisibleSelected} onCheckedChange={(v: any) => toggleSelectAll(!!v)} />
              <span className="text-sm text-slate-300">Selecionar todos</span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950/60 p-10">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : visibleReferences.length === 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-6 text-slate-400">
              Nenhuma referência de pagamento encontrada para o filtro selecionado.
            </div>
          ) : (
            <div className="max-h-[620px] space-y-4 overflow-y-auto pr-1">
              {visibleReferences.map((reference) => (
                <Card key={reference.id} className="border-slate-700 bg-slate-950/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      {confirmationMode === "bank_report" && (
                        <Checkbox checked={!!selectedReferences[reference.id]} onCheckedChange={(v: any) => toggleReferenceSelection(reference.id, !!v)} />
                      )}
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pedido</p>
                        <p className="text-sm font-semibold text-white">{reference.requestId}</p>
                        <p className="text-xs text-slate-400">Mecânico: {reference.mechanicName}</p>
                        <p className="text-xs text-slate-400">Usuário ID: {reference.userId}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{reference.status}</Badge>
                      <Badge variant="outline">
                        {reference.paymentMethod === "iban" ? "IBAN" : "Multicaixa Express"}
                      </Badge>
                      <span className="text-sm font-semibold text-white">{formatCurrency(reference.amount)}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-500">Referência</p>
                      <p className="text-sm text-slate-100 break-all">{reference.reference}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Data</p>
                      <p className="text-sm text-slate-100">{formatDate(reference.createdAt)}</p>
                    </div>
                  </div>

                  {confirmationMode === "bank_report" && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 items-end">
                      <div>
                        <p className="text-xs text-slate-500">Valor atual</p>
                        <p className="text-sm text-white">{formatCurrency(reference.amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Valor (ajustar antes de confirmar)</p>
                        <Input
                          value={(adminAmounts[reference.requestId] ?? reference.amount).toString()}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value.replace(',', '.')) || 0;
                            setAdminAmounts((prev) => ({ ...prev, [reference.requestId]: v }));
                          }}
                          className="bg-slate-900/80 text-white"
                        />
                      </div>
                    </div>
                  )}

                  {reference.note ? (
                    <div className="mt-4 rounded-xl bg-slate-900/80 p-3 text-sm text-slate-300">
                      <p className="text-slate-400">Observação</p>
                      <p>{reference.note}</p>
                    </div>
                  ) : null}
                  <div className="mt-4 flex items-center gap-2">
                    {confirmationMode === "bank_report" && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      try {
                        const amountToApply = typeof adminAmounts[reference.requestId] === 'number' ? adminAmounts[reference.requestId] : reference.amount;
                        await apiClient.updatePaymentReferenceStatus(reference.requestId, 'approved', 'Confirmado pelo admin', true, amountToApply);
                        toast.success('Referência confirmada. Dívida atualizada.');
                        await loadPaymentReferences();
                      } catch (err: any) {
                        console.error('Erro ao confirmar referência:', err);
                        toast.error(err?.message || 'Erro ao confirmar referência.');
                      }
                    }} disabled={reference.status === 'approved'}>
                      Confirmar
                    </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={async () => {
                      if (!window.confirm('Deseja eliminar esta referência permanentemente?')) return;
                      try {
                        await apiClient.deletePaymentReference(reference.requestId);
                        toast.success('Referência eliminada.');
                        await loadPaymentReferences();
                      } catch (err: any) {
                        console.error('Erro ao eliminar referência:', err);
                        toast.error(err?.message || 'Erro ao eliminar referência.');
                      }
                    }}>
                      Eliminar
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};
