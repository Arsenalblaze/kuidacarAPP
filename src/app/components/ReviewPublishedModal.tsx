import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import StarRating from './StarRating';
import { Button } from './ui/button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  rating?: number | null;
  comment?: string | null;
  mechanicName?: string | null;
}

export default function ReviewPublishedModal({ isOpen, onClose, rating = null, comment = null, mechanicName = null }: Props) {
  const handleOpenChange = (nextOpen: boolean) => {
    // prevent closing via overlay/esc
    if (!nextOpen) return;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex items-start justify-between">
          <div>
            <DialogTitle>Avaliação publicada</DialogTitle>
            <DialogDescription>
              {mechanicName ? `Avaliação para: ${mechanicName}` : 'Sua avaliação foi publicada'}
            </DialogDescription>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Nota</span>
              <StarRating value={rating || 0} readOnly size={18} />
            </div>
            <div className="text-sm text-gray-500">{rating ?? '-'} / 5</div>
          </div>

          <div>
            <p className="text-sm text-gray-700">Comentário</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{comment || '—'}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Fechar</Button>
        </div>

        <div className="absolute top-4 right-4">
          <button onClick={onClose} className="rounded-full p-1 text-gray-600 hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
