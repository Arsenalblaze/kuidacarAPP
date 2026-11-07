import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";

interface Ticket {
  id: string;
  cliente_id: string;
  categoria: string;
  assunto: string;
  mensagem: string;
  resposta_admin?: string | null;
  status: string;
  data_envio: string;
  data_resposta?: string | null;
}

interface Props {
  isOpen: boolean;
  ticketId: string | null;
  onClose: () => void;
  apiClient: any;
}

export const SupportTicketDetailsModal = ({ isOpen, ticketId, onClose, apiClient }: Props) => {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !ticketId) return;
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const id = String(ticketId).replace(/^support:/, "");
        const resp = await apiClient.getSupportTicketById(id);
        if (mounted && resp?.success) setTicket(resp.ticket || null);
      } catch (err) {
        console.warn('Erro ao carregar ticket:', err);
        setTicket(null);
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [isOpen, ticketId, apiClient]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <p>Carregando...</p>
          ) : !ticket ? (
            <p className="text-sm text-gray-500">Nenhum ticket encontrado.</p>
          ) : (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Assunto</Label>
                  <div className="mt-1 p-3 rounded border bg-white text-sm">{ticket.assunto}</div>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <div className="mt-1 p-3 rounded border bg-white text-sm">{ticket.categoria}</div>
                </div>
              </div>

              <div className="mt-4">
                <Label>Mensagem do cliente</Label>
                <div className="mt-1 p-3 rounded border bg-white text-sm whitespace-pre-line">{ticket.mensagem}</div>
              </div>

              <div className="mt-4">
                <Label>Resposta do admin</Label>
                <div className="mt-1 p-3 rounded border bg-white text-sm whitespace-pre-line">
                  {ticket.resposta_admin || "Sem resposta ainda."}
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button onClick={onClose}>Fechar</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupportTicketDetailsModal;
