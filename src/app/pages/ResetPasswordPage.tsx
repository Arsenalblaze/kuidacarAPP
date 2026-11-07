import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { supabase } from "../utils/api";
import { PASSWORD_RECOVERY_SESSION_KEY } from "../utils/authRedirects";
import { translateAuthErrorMessage } from "../utils/authErrors";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const initializeRecoverySession = async () => {
      try {
        const navigationState = location.state as { authLinkError?: string } | null;
        if (navigationState?.authLinkError) {
          throw new Error(navigationState.authLinkError);
        }

        if (sessionStorage.getItem(PASSWORD_RECOVERY_SESSION_KEY) !== "true") {
          throw new Error("Link de recuperação inválido ou expirado.");
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!session) {
          throw new Error("Link de recuperação inválido ou expirado.");
        }

        setEmail(session.user.email || "");
        setIsReady(true);
      } catch (error: any) {
        console.error("Erro na recuperação de senha:", error);
        toast.error(translateAuthErrorMessage(error?.message || "Não foi possível validar o link de recuperação."));
        sessionStorage.removeItem(PASSWORD_RECOVERY_SESSION_KEY);
        navigate("/login", { replace: true });
      }
    };

    initializeRecoverySession();
  }, [location.state, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword.trim() || !confirmPassword.trim()) {
      toast.error("Preencha a nova senha e a confirmação.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("A confirmação da senha não coincide.");
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        throw error;
      }

      sessionStorage.removeItem(PASSWORD_RECOVERY_SESSION_KEY);
      toast.success("Senha alterada com sucesso!");
      navigate("/login", { replace: true, state: { message: "Sua senha foi redefinida com sucesso." } });
    } catch (error: any) {
      console.error("Erro ao alterar senha:", error);
      toast.error(translateAuthErrorMessage(error?.message || "Não foi possível alterar a senha."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-6 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Criar nova senha</h1>
          <p className="text-sm text-gray-600 mt-2">
            {email ? `Defina uma nova senha para ${email}` : "Validando link de recuperação..."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={!isReady || isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={!isReady || isLoading}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-700"
            disabled={!isReady || isLoading}
          >
            {isLoading ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
