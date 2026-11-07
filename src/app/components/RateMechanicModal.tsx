import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import StarRating from './StarRating';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { apiClient } from '../utils/api';
import { toast } from 'sonner';
import { PLATFORM_COMMISSION_PERCENTAGE } from '../utils/commission';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  requestId: string | null;
  mechanicId: string | null;
  mechanicName?: string | null;
  onSubmitted?: () => void;
}

export default function RateMechanicModal({ isOpen, onClose, requestId, mechanicId, mechanicName, onSubmitted }: Props) {
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleOpenChange = (next: boolean) => {
    // prevent closing by overlay while loading
    if (!next && loading) return;
    if (!next) {
      setRating(5);
      setComment('');
    }
  };

  const handleFinish = async (submitReview: boolean) => {
    if (!requestId || (submitReview && !mechanicId)) {
      toast.error('Dados do atendimento ausentes');
      return;
    }

    setLoading(true);
    try {
      const requestResponse = await apiClient.getServiceRequest(requestId);
      if (requestResponse.request.status !== 'awaiting_customer_confirmation') {
        throw new Error('O mecânico ainda não pediu a confirmação da conclusão deste serviço.');
      }

      if (submitReview && mechanicId) {
        const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(requestId);

        if (isUuid) {
          await apiClient.createMechanicReview({ mechanicId, rating, comment: comment || null, serviceId: requestId });
        } else {
          await apiClient.createMechanicReview({ mechanicId, rating, comment: comment || null, serviceId: null });
        }
      }

      const response = await apiClient.finalizeServiceRequest(requestId);
      const providerId = mechanicId || response.request?.provider_id || response.request?.providerId;
      let providerStatusError: string | null = null;
      if (providerId) {
        const statusResponse = await apiClient.setProviderStatus(providerId, 'available');
        if (!statusResponse.success) {
          providerStatusError = statusResponse.error || 'Não foi possível disponibilizar o mecânico.';
          console.error('Solicitação finalizada, mas não foi possível disponibilizar o mecânico:', providerStatusError);
        }
      }

      if (providerId) {
        await apiClient.sendMessage(
          requestId,
          providerId,
          'A solicitação foi terminada com sucesso pelo cliente. O processo foi concluído.',
        ).catch((error) => console.warn('Não foi possível enviar mensagem de término ao mecânico:', error));
      }

      toast.success(submitReview ? 'Avaliação enviada e solicitação finalizada' : 'Solicitação finalizada sem avaliação');
      if (providerStatusError) {
        toast.error(`A solicitação foi finalizada, mas o mecânico não ficou disponível: ${providerStatusError}`);
      }
      onClose();
      if (onSubmitted) onSubmitted();
    } catch (err: any) {
      console.error('Erro ao enviar avaliação e finalizar:', err);
      toast.error(err?.message || 'Erro ao processar avaliação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <div>
          <DialogTitle>Confirmar conclusão e avaliar</DialogTitle>
          <DialogDescription>
            {mechanicName
              ? `Confirme que o serviço foi concluído. A comissão de ${PLATFORM_COMMISSION_PERCENTAGE}% só será registada após esta confirmação. Pode avaliar ${mechanicName} ou concluir sem avaliar.`
              : `Confirme que o serviço foi concluído. A comissão de ${PLATFORM_COMMISSION_PERCENTAGE}% só será registada após esta confirmação.`}
          </DialogDescription>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Nota</span>
              <StarRating value={rating} onChange={(v) => setRating(v)} />
            </div>
            <div className="text-sm text-gray-500">{rating} / 5</div>
          </div>

          <div>
            <Textarea value={comment} onChange={(e: any) => setComment(e.target.value)} placeholder="Deixe um comentário (opcional)" />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { if (!loading) onClose(); }} disabled={loading}>Cancelar</Button>
          <Button variant="outline" onClick={() => handleFinish(false)} disabled={loading}>
            {loading ? 'A terminar...' : 'Terminar sem avaliar'}
          </Button>
          {mechanicId && (
            <Button onClick={() => handleFinish(true)} disabled={loading}>
              {loading ? 'A enviar...' : 'Avaliar e encerrar'}
            </Button>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
