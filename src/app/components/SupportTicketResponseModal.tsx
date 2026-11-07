import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "../utils/api";

interface Ticket {
  id: string;
  cliente_id: string;
  categoria: string;
  assunto: string;
  mensagem: string;
  resposta_admin?: string | null;
  status: "Aberto" | "Respondido" | "Fechado";
  data_envio: string;
  data_resposta?: string | null;
}

interface SupportTicketResponseModalProps {
  isOpen: boolean;
  ticket: Ticket | null;
  onClose: () => void;
  onSubmit: (ticketId: string, resposta_admin: string) => Promise<void>;
}

export const SupportTicketResponseModal = ({
  isOpen,
  ticket,
  onClose,
  onSubmit,
}: SupportTicketResponseModalProps) => {
  const [responseText, setResponseText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (ticket?.resposta_admin) {
      setResponseText(ticket.resposta_admin);
    } else {
      setResponseText("");
    }
  }, [ticket]);

  const handleSubmit = async () => {
    if (!ticket) return;
    if (!responseText.trim()) {
      toast.error("A resposta não pode ficar vazia.");
      return;
    }

    try {
      setIsSaving(true);
      await onSubmit(ticket.id, responseText.trim());
      try { await apiClient.clearRespondingFlag('ticket', ticket.id); } catch (e) { /* ignore */ }
      onClose();
    } catch (error) {
      console.error("Erro ao enviar resposta:", error);
      toast.error("Erro ao enviar resposta.");
    } finally {
      setIsSaving(false);
    }
  };

  // mark ticket as 'A responder' when admin starts typing, and revert to 'Aberto' if cleared or modal closed
  const handleChange = async (value: string) => {
    setResponseText(value);
    try {
      if (!ticket) return;
      const trimmed = value.trim();
      if (trimmed.length > 0 && !isTyping) {
        setIsTyping(true);
        await apiClient.updateSupportTicketStatus(ticket.id, 'A responder');
        await apiClient.setRespondingFlag('ticket', ticket.id);
      } else if (trimmed.length === 0 && isTyping) {
        setIsTyping(false);
        await apiClient.updateSupportTicketStatus(ticket.id, 'Aberto');
        await apiClient.clearRespondingFlag('ticket', ticket.id);
      }
    } catch (err) {
      console.warn('Erro ao marcar ticket como a responder:', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Responder Ticket de Suporte</DialogTitle>
          <DialogDescription>
            {ticket
              ? `Ticket #${ticket.id} - ${ticket.assunto}`
              : "Selecione um ticket para responder."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {ticket ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Categoria</Label>
                  <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
                    {ticket.categoria}
                  </div>
                </div>
                <div>
                  <Label>Cliente</Label>
                  <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
                    {ticket.cliente_id}
                  </div>
                </div>
              </div>

              <div>
                <Label>Mensagem do cliente</Label>
                <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 whitespace-pre-line">
                  {ticket.mensagem}
                </div>
              </div>

              <div>
                <Label htmlFor="resposta_admin">Resposta do administrador</Label>
                <Textarea
                  id="resposta_admin"
                  placeholder="Digite a resposta que será enviada ao cliente..."
                  value={responseText}
                  onChange={(e) => handleChange(e.target.value)}
                  rows={8}
                  className="mt-2 resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">{responseText.length}/1000 caracteres</p>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={async () => {
                  // if admin was typing and closes without submitting, revert status to Aberto
                  if (isTyping && ticket) {
                    try { await apiClient.updateSupportTicketStatus(ticket.id, 'Aberto'); } catch (e) { /* ignore */ }
                    try { await apiClient.clearRespondingFlag('ticket', ticket.id); } catch (e) { /* ignore */ }
                  }
                  onClose();
                }} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  {isSaving ? "Enviando..." : "Enviar resposta"}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-slate-400">Nenhum ticket selecionado.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
