import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reason?: string | null;
  fromName?: string | null;
}

export default function BlockedReasonModal({ isOpen, onClose, reason, fromName }: Props) {
  // Prevent overlay/esc from closing: only allow close via explicit onClose call
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // ignore automatic attempts to close (overlay, escape)
      return;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex items-start justify-between">
          <div>
            <DialogTitle>Solicitação bloqueada</DialogTitle>
            <DialogDescription>
              {fromName ? `De: ${fromName}` : 'Motivo enviado'}
            </DialogDescription>
          </div>
        </div>

        <div className="mt-4">
          <p className="whitespace-pre-wrap text-sm text-gray-800">{reason || 'Sem motivo informado'}</p>
        </div>

        <p className="mt-6 text-xs text-gray-500">A solicitação está bloqueada. Para continuar, feche este modal.</p>
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
