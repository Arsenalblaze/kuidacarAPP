import React, { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';

export default function ConfirmPasswordModal({
  visible,
  email,
  role,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  email?: string | null;
  role?: string | null;
  onConfirm: (password: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-2">Confirme sua senha</h3>
        <p className="text-sm text-gray-600 mb-4">Para continuar, confirme a senha da conta <strong>{email}</strong>.</p>

        <div className="space-y-3">
          <div>
            <Label htmlFor="confirm-password">Senha</Label>
            <Input id="confirm-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => { setPassword(''); onClose(); }}>Cancelar</Button>
            <Button
              type="button"
              onClick={async () => {
                if (!password) return toast.error('Digite a sua senha');
                setLoading(true);
                try {
                  const ok = await onConfirm(password);
                  if (ok) {
                    toast.success('Autenticado com sucesso');
                    onClose();
                  } else {
                    toast.error('Senha inválida');
                  }
                } catch (err) {
                  console.error('Erro ao confirmar senha:', err);
                  toast.error('Erro ao autenticar');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              {loading ? 'Verificando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
