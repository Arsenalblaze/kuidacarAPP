import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";

interface BlockRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  title?: string;
}

export function BlockRequestModal({ isOpen, onClose, onSubmit, title = 'Bloquear Solicitação' }: BlockRequestModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setReason("");
      setLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!reason || reason.trim().length < 3) {
      toast.error('Por favor informe um motivo (mínimo 3 caracteres)');
      return;
    }

    try {
      setLoading(true);
      await onSubmit(reason.trim());
    } catch (err: any) {
      console.error('Erro ao bloquear solicitação:', err);
      toast.error(err?.message || 'Erro ao bloquear solicitação');
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <p className="text-sm text-gray-600 mb-2">Informe o motivo do bloqueio — essa mensagem será enviada ao outro usuário.</p>
          <Textarea value={reason} onChange={(e: any) => setReason(e.target.value)} placeholder="Descreva o motivo..." />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button className="ml-2" onClick={handleSubmit} disabled={loading}>{loading ? 'A enviar...' : 'Bloquear e enviar motivo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BlockRequestModal;
