import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FAQ {
  id: string;
  pergunta: string;
  resposta: string;
  ordem: number;
  ativa: boolean;
  created_at: string;
  updated_at: string;
}

interface FaqEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  faq?: FAQ | null;
  onSave: (faqData: {
    pergunta: string;
    resposta: string;
    ordem: number;
  }) => Promise<void>;
  nextOrder: number;
}

export const FaqEditModal = ({
  isOpen,
  onClose,
  faq,
  onSave,
  nextOrder,
}: FaqEditModalProps) => {
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");
  const [ordem, setOrdem] = useState(nextOrder);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (faq) {
      setPergunta(faq.pergunta);
      setResposta(faq.resposta);
      setOrdem(faq.ordem);
    } else {
      setPergunta("");
      setResposta("");
      setOrdem(nextOrder);
    }
  }, [faq, nextOrder, isOpen]);

  const handleSave = async () => {
    if (!pergunta.trim()) {
      toast.error("Pergunta é obrigatória");
      return;
    }
    if (!resposta.trim()) {
      toast.error("Resposta é obrigatória");
      return;
    }

    try {
      setIsSaving(true);
      await onSave({
        pergunta: pergunta.trim(),
        resposta: resposta.trim(),
        ordem,
      });
      onClose();
    } catch (error) {
      console.error("Erro ao salvar FAQ:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{faq ? "Editar FAQ" : "Criar Nova FAQ"}</DialogTitle>
          <DialogDescription>
            {faq
              ? "Atualize os detalhes da pergunta frequente"
              : "Adicione uma nova pergunta frequente"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Ordem */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ordem">Ordem</Label>
              <Input
                id="ordem"
                type="number"
                value={ordem}
                onChange={(e) => setOrdem(parseInt(e.target.value) || 0)}
                min="1"
                className="mt-2"
              />
              <p className="text-xs text-slate-400 mt-1">
                Menor número = maior prioridade
              </p>
            </div>
          </div>

          {/* Pergunta */}
          <div>
            <Label htmlFor="pergunta">Pergunta</Label>
            <Input
              id="pergunta"
              placeholder="Ex: Como faço para solicitar assistência?"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              className="mt-2"
            />
            <p className="text-xs text-slate-400 mt-1">
              {pergunta.length}/200 caracteres
            </p>
          </div>

          {/* Resposta */}
          <div>
            <Label htmlFor="resposta">Resposta</Label>
            <Textarea
              id="resposta"
              placeholder="Digite a resposta para a pergunta..."
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              rows={6}
              className="mt-2 resize-none"
            />
            <p className="text-xs text-slate-400 mt-1">
              {resposta.length}/1000 caracteres
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isSaving ? "Salvando..." : "Salvar FAQ"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
