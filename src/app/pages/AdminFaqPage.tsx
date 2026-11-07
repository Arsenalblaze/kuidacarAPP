import { useEffect, useState } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { FaqEditModal } from "../components/FaqEditModal";
import { apiClient } from "../utils/api";
import { toast } from "sonner";
import {
  HelpCircle,
  Plus,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { Badge } from "../components/ui/badge";

interface FAQ {
  id: string;
  pergunta: string;
  resposta: string;
  ordem: number;
  ativa: boolean;
  created_at: string;
  updated_at: string;
}

export const AdminFaqPage = () => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadFaqs();
  }, []);

  const loadFaqs = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAllFaqs();
      if (response.success) {
        setFaqs(response.faqs || []);
      } else {
        setFaqs([]);
      }
    } catch (error) {
      console.error("Erro ao carregar FAQs:", error);
      toast.error("Erro ao carregar FAQs");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingFaq(null);
    setIsModalOpen(true);
  };

  const handleEdit = (faq: FAQ) => {
    setEditingFaq(faq);
    setIsModalOpen(true);
  };

  const handleSave = async (faqData: {
    pergunta: string;
    resposta: string;
    ordem: number;
  }) => {
    try {
      setIsSaving(true);

      if (editingFaq) {
        // Update
        const result = await apiClient.updateFaq(
          editingFaq.id,
          faqData.pergunta,
          faqData.resposta,
          faqData.ordem,
          undefined
        );

        if (result.success) {
          toast.success("FAQ atualizada com sucesso!");
          await loadFaqs();
        } else {
          toast.error("Erro ao atualizar FAQ");
        }
      } else {
        // Create
        const result = await apiClient.createFaq(
          faqData.pergunta,
          faqData.resposta,
          faqData.ordem
        );

        if (result.success) {
          toast.success("FAQ criada com sucesso!");
          await loadFaqs();
        } else {
          toast.error("Erro ao criar FAQ");
        }
      }
    } catch (error) {
      console.error("Erro ao salvar FAQ:", error);
      toast.error("Erro ao salvar FAQ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (faqId: string) => {
    if (!window.confirm("Tem certeza que deseja deletar esta FAQ?")) return;

    try {
      setDeletingId(faqId);
      const result = await apiClient.deleteFaq(faqId);

      if (result.success) {
        toast.success("FAQ deletada com sucesso!");
        await loadFaqs();
      } else {
        toast.error("Erro ao deletar FAQ");
      }
    } catch (error) {
      console.error("Erro ao deletar FAQ:", error);
      toast.error("Erro ao deletar FAQ");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (faq: FAQ) => {
    try {
      const result = await apiClient.updateFaq(
        faq.id,
        undefined,
        undefined,
        undefined,
        !faq.ativa
      );

      if (result.success) {
        toast.success(
          `FAQ ${!faq.ativa ? "ativada" : "desativada"} com sucesso!`
        );
        await loadFaqs();
      } else {
        toast.error("Erro ao atualizar status");
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleReorder = async (faq: FAQ, direction: "up" | "down") => {
    try {
      const targetOrder =
        direction === "up" ? Math.max(1, faq.ordem - 1) : faq.ordem + 1;

      // Find FAQ at target order
      const targetFaq = faqs.find((f) => f.ordem === targetOrder);

      if (!targetFaq) return;

      // Swap orders
      const result1 = await apiClient.updateFaq(
        faq.id,
        undefined,
        undefined,
        targetOrder,
        undefined
      );

      const result2 = await apiClient.updateFaq(
        targetFaq.id,
        undefined,
        undefined,
        faq.ordem,
        undefined
      );

      if (result1.success && result2.success) {
        toast.success("Ordem atualizada!");
        await loadFaqs();
      } else {
        toast.error("Erro ao reordenar");
      }
    } catch (error) {
      console.error("Erro ao reordenar:", error);
      toast.error("Erro ao reordenar");
    }
  };

  const sortedFaqs = [...faqs].sort((a, b) => a.ordem - b.ordem);
  const totalFaqs = faqs.length;
  const activeFaqs = faqs.filter((f) => f.ativa);
  const inactiveFaqs = faqs.filter((f) => !f.ativa);

  if (loading) {
    return (
      <AdminLayout title="FAQ" subtitle="Gerenciar perguntas frequentes">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-spin" />
            <p className="text-slate-400">Carregando FAQs...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="FAQ" subtitle="Gerenciar perguntas frequentes">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-500/10 border-blue-500/20 p-4">
            <div className="flex items-center gap-3">
              <HelpCircle className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-slate-400 text-sm">Total de FAQs</p>
                <p className="text-2xl font-bold text-white">{totalFaqs}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-green-500/10 border-green-500/20 p-4">
            <div className="flex items-center gap-3">
              <Eye className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-slate-400 text-sm">FAQs Ativas</p>
                <p className="text-2xl font-bold text-white">{activeFaqs.length}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-orange-500/10 border-orange-500/20 p-4">
            <div className="flex items-center gap-3">
              <EyeOff className="w-8 h-8 text-orange-400" />
              <div>
                <p className="text-slate-400 text-sm">FAQs Inativas</p>
                <p className="text-2xl font-bold text-white">{inactiveFaqs.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Create Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleCreateNew}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova FAQ
          </Button>
        </div>

        {/* FAQs List */}
        <div className="space-y-6">
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">FAQs Ativas</p>
                <p className="text-slate-400 text-sm">Mostrando {activeFaqs.length} perguntas e respostas ativas</p>
              </div>
            </div>
            {activeFaqs.length === 0 ? (
              <Card className="bg-slate-900 border-slate-700 p-8">
                <div className="flex items-center justify-center gap-3 text-slate-400">
                  <HelpCircle className="w-6 h-6" />
                  <p>Nenhuma FAQ ativa no momento</p>
                </div>
              </Card>
            ) : (
              <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
                {activeFaqs.map((faq) => (
                  <Card
                    key={faq.id}
                    className="bg-slate-900/50 border-slate-700 p-4 hover:bg-slate-900 transition-colors"
                  >
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white break-words leading-relaxed">{faq.pergunta}</p>
                            <p className="mt-1 text-sm text-slate-400 leading-relaxed break-words whitespace-pre-wrap">{faq.resposta}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <Badge
                              variant={faq.ativa ? "default" : "secondary"}
                              className={faq.ativa ? "bg-green-600" : "bg-slate-600"}
                            >
                              {faq.ativa ? "Ativa" : "Inativa"}
                            </Badge>
                            <Badge variant="outline" className="border-slate-600">#{faq.ordem}</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 xl:ml-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReorder(faq, "up")}
                          disabled={faq.ordem === 1}
                          className="text-slate-400 hover:text-white"
                          title="Mover para cima"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReorder(faq, "down")}
                          disabled={faq.ordem === sortedFaqs.length}
                          className="text-slate-400 hover:text-white"
                          title="Mover para baixo"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleStatus(faq)}
                          className={`${
                            faq.ativa
                              ? "text-green-400 hover:text-green-300"
                              : "text-slate-500 hover:text-slate-400"
                          }`}
                          title={faq.ativa ? "Desativar" : "Ativar"}
                        >
                          {faq.ativa ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(faq)}
                          className="text-blue-400 hover:text-blue-300"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(faq.id)}
                          disabled={deletingId === faq.id}
                          className="text-red-400 hover:text-red-300"
                          title="Deletar"
                        >
                          {deletingId === faq.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">FAQs Inativas</p>
                <p className="text-slate-400 text-sm">Mostrando {inactiveFaqs.length} perguntas e respostas inativas</p>
              </div>
            </div>
            {inactiveFaqs.length === 0 ? (
              <Card className="bg-slate-900 border-slate-700 p-8">
                <div className="flex items-center justify-center gap-3 text-slate-400">
                  <HelpCircle className="w-6 h-6" />
                  <p>Nenhuma FAQ inativa</p>
                </div>
              </Card>
            ) : (
              <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
                {inactiveFaqs.map((faq) => (
                  <Card
                    key={faq.id}
                    className="bg-slate-900/50 border-slate-700 p-4 hover:bg-slate-900 transition-colors"
                  >
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white break-words leading-relaxed">{faq.pergunta}</p>
                            <p className="mt-1 text-sm text-slate-400 leading-relaxed break-words whitespace-pre-wrap">{faq.resposta}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <Badge
                              variant={faq.ativa ? "default" : "secondary"}
                              className={faq.ativa ? "bg-green-600" : "bg-slate-600"}
                            >
                              {faq.ativa ? "Ativa" : "Inativa"}
                            </Badge>
                            <Badge variant="outline" className="border-slate-600">#{faq.ordem}</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 xl:ml-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReorder(faq, "up")}
                          disabled={faq.ordem === 1}
                          className="text-slate-400 hover:text-white"
                          title="Mover para cima"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReorder(faq, "down")}
                          disabled={faq.ordem === sortedFaqs.length}
                          className="text-slate-400 hover:text-white"
                          title="Mover para baixo"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleStatus(faq)}
                          className={`${
                            faq.ativa
                              ? "text-green-400 hover:text-green-300"
                              : "text-slate-500 hover:text-slate-400"
                          }`}
                          title={faq.ativa ? "Desativar" : "Ativar"}
                        >
                          {faq.ativa ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(faq)}
                          className="text-blue-400 hover:text-blue-300"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(faq.id)}
                          disabled={deletingId === faq.id}
                          className="text-red-400 hover:text-red-300"
                          title="Deletar"
                        >
                          {deletingId === faq.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <FaqEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        faq={editingFaq}
        onSave={handleSave}
        nextOrder={sortedFaqs.length + 1}
      />
    </AdminLayout>
  );
};

