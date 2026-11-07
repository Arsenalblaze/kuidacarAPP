import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Car, Wrench, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { apiClient, supabase } from "../utils/api";
import { getPasswordRecoveryRedirect, PASSWORD_RECOVERY_SESSION_KEY } from "../utils/authRedirects";
import { translateAuthErrorMessage } from "../utils/authErrors";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [emailVerifiedBanner, setEmailVerifiedBanner] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsRole, setTermsRole] = useState<"customer" | "provider" | null>(null);
  const [termsContent, setTermsContent] = useState("");
  const [privacyNotice, setPrivacyNotice] = useState("");
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [termsVersion, setTermsVersion] = useState(1);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [termsCheckDone, setTermsCheckDone] = useState(false);
  const [termsSaving, setTermsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "customer" | "provider"
  >("customer");

  useEffect(() => {
    const defaultTab = (location.state as any)?.defaultTab;
    if (defaultTab === "provider") {
      setActiveTab("provider");
    } else if (defaultTab === "customer") {
      setActiveTab("customer");
    }
  }, [location.state]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    if (user.role === "admin" || user.role === "super_admin") {
      navigate("/admin", { replace: true });
      return;
    }

    if (user.role !== "provider" && user.role !== "customer") return;
    const acceptedRole: "customer" | "provider" = user.role;
    setTermsCheckDone(false);
    setTermsError(null);
    let isActive = true;

    apiClient.ensureTermsAcceptance(user.id, acceptedRole).then((response) => {
      if (!isActive) return;
      setTermsContent(response.content);
      setPrivacyNotice(response.privacyNotice || "");
      setTermsVersion(response.version);
      if (!response.success) {
        setTermsRole(acceptedRole);
        setTermsOpen(true);
        setTermsError(response.error || "Não foi possível verificar os termos e condições.");
        return;
      }
      if (!response.hasSeen) {
        setTermsRole(acceptedRole);
        setPrivacyAcknowledged(false);
        setTermsOpen(true);
      } else {
        setTermsCheckDone(true);
      }
    }).catch((error) => {
      if (!isActive) return;
      setTermsRole(acceptedRole);
      setTermsOpen(true);
      setTermsError(error instanceof Error ? error.message : "Não foi possível verificar os termos e condições.");
    });

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, user?.id, user?.role, navigate]);

  useEffect(() => {
    if (!isAuthenticated || !user || !termsCheckDone || termsOpen || termsError) return;

    if (user.role === "provider") {
      navigate("/provider", { replace: true });
      return;
    }

    if (user.role === "customer") {
      navigate("/request", { replace: true });
    }
  }, [isAuthenticated, user, termsCheckDone, termsOpen, termsError, navigate]);

  const confirmTerms = async () => {
    if (!user || !termsRole || termsError) return;
    if (!privacyAcknowledged) {
      toast.error("Leia e confirme que tomou conhecimento do aviso de privacidade.");
      return;
    }

    try {
      setTermsSaving(true);
      const response = await apiClient.markTermsSeen(user.id, termsRole, termsVersion);
      if (!response.success) throw new Error(response.error || "Não foi possível guardar a confirmação.");
      setTermsOpen(false);
      setTermsCheckDone(true);
      toast.success("Termos e condições confirmados.");
    } catch (error) {
      console.error("Erro ao confirmar termos e condições:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar os termos.");
    } finally {
      setTermsSaving(false);
    }
  };

  const [customerData, setCustomerData] = useState({
    email: "",
    password: "",
  });

  const [providerData, setProviderData] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    const message = (location.state as any)?.message;
    if (message) {
      toast.success(message);
    }

    const params = new URLSearchParams(location.search);
    const verified = params.get("verified");
    const type = params.get("type");

    if (verified === "true" || verified === "1" || type === "signup") {
      setEmailVerifiedBanner(true);
      toast.success("✅ Email verificado com sucesso! Agora você já pode fazer login.");
    }
  }, [location.search, location.state]);

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      setTermsCheckDone(false);
      await login(
        customerData.email,
        customerData.password,
        "customer",
      );
      toast.success("✅ Login realizado! Bem-vindo de volta!");
    } catch (error: any) {
      console.error("Erro no login:", error);
      const errorMessage =
        translateAuthErrorMessage(error.message || "Verifique suas credenciais.");
      toast.error(`❌ Erro ao fazer login: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      setTermsCheckDone(false);
      await login(
        providerData.email,
        providerData.password,
        "provider",
      );

      toast.success("✅ Login realizado! Bem-vindo de volta!");
    } catch (error: any) {
      console.error("Erro no login:", error);
      const errorMessage =
        translateAuthErrorMessage(error.message || "Verifique suas credenciais.");
      toast.error(`❌ Erro ao fazer login: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverPassword = async () => {
    const email = forgotPasswordEmail.trim().toLowerCase();

    if (!email) {
      toast.error("Digite o email para recuperar a senha.");
      return;
    }

    try {
      setForgotPasswordLoading(true);
      sessionStorage.removeItem(PASSWORD_RECOVERY_SESSION_KEY);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordRecoveryRedirect(),
      });

      if (error) {
        throw error;
      }

      toast.success("✅ Link de recuperação enviado para o seu email.");
      setIsForgotPasswordOpen(false);
      setForgotPasswordEmail("");
      window.open("https://mail.google.com", "_blank", "noopener,noreferrer");
    } catch (error: any) {
      console.error("Erro ao enviar email de recuperação:", error);
      toast.error(translateAuthErrorMessage(error?.message || "Não foi possível enviar o link de recuperação."));
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (
    <>
      <Dialog open={termsOpen} onOpenChange={() => {
        if (termsOpen) toast.info("Confirme os termos para continuar.");
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {termsRole === "provider" ? "Termos e condições do mecânico" : "Termos e condições do cliente"}
            </DialogTitle>
            <DialogDescription>
              Leia cuidadosamente antes de continuar. Poderá consultar estes termos novamente nas configurações da sua conta.
            </DialogDescription>
          </DialogHeader>

          {termsError ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{termsError}</p>
          ) : (
            <div className="mt-4 max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm leading-6 text-gray-800">
              <h3 className="mb-2 font-semibold">Termos e condições</h3>
              {termsContent}
              <h3 className="mb-2 mt-5 font-semibold">Aviso de privacidade</h3>
              {privacyNotice}
            </div>
          )}

          {!termsError && (
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={privacyAcknowledged}
                onChange={(event) => setPrivacyAcknowledged(event.target.checked)}
                className="mt-1"
              />
              <span>Li e tomei conhecimento do aviso de privacidade da KuidaCar.</span>
            </label>
          )}

          <DialogFooter className="mt-4">
            <Button
              type="button"
              className="bg-orange-600 hover:bg-orange-700"
              onClick={confirmTerms}
              disabled={termsSaving || Boolean(termsError) || !termsContent.trim() || !privacyNotice.trim() || !privacyAcknowledged}
            >
              {termsSaving ? "A guardar..." : "Aceito os termos e continuo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <div className="bg-orange-600 text-white p-6 pb-12">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Car className="w-10 h-10" />
            <h1 className="text-3xl font-bold">KuidaCar</h1>
          </div>
          <p className="text-orange-100">Entre na sua conta</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-6 -mt-8">
        {emailVerifiedBanner && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
            ✅ Email verificado com sucesso. Agora você já pode fazer login.
          </div>
        )}
        <Card className="p-6 shadow-lg">
          <Tabs
              value={activeTab}
              onValueChange={(v) =>
                setActiveTab(v as "customer" | "provider")
              }
            >
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="customer" className="gap-2">
                  <Car className="w-4 h-4" />
                  Cliente
                </TabsTrigger>
                <TabsTrigger value="provider" className="gap-2">
                  <Wrench className="w-4 h-4" />
                  Prestador
                </TabsTrigger>
              </TabsList>

              {/* Customer Login */}
              <TabsContent value="customer">
                <form
                  onSubmit={handleCustomerLogin}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="customer-email">E-mail</Label>
                    <Input
                      id="customer-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={customerData.email}
                      onChange={(e) =>
                        setCustomerData({
                          ...customerData,
                          email: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customer-password">
                      Senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="customer-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={customerData.password}
                        onChange={(e) =>
                          setCustomerData({
                            ...customerData,
                            password: e.target.value,
                          })
                        }
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() =>
                          setShowPassword(!showPassword)
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    disabled={isLoading}
                  >
                    {isLoading ? "Entrando..." : "Entrar"}
                  </Button>

                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm text-orange-600"
                      onClick={() => setIsForgotPasswordOpen(true)}
                    >
                      Esqueceu a senha?
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* Provider Login */}
              <TabsContent value="provider">
                <form
                  onSubmit={handleProviderLogin}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="provider-email">E-mail</Label>
                    <Input
                      id="provider-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={providerData.email}
                      onChange={(e) =>
                        setProviderData({
                          ...providerData,
                          email: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="provider-password">
                      Senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="provider-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={providerData.password}
                        onChange={(e) =>
                          setProviderData({
                            ...providerData,
                            password: e.target.value,
                          })
                        }
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() =>
                          setShowPassword(!showPassword)
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    disabled={isLoading}
                  >
                    {isLoading ? "Entrando..." : "Entrar"}
                  </Button>

                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm text-orange-600"
                      onClick={() => setIsForgotPasswordOpen(true)}
                    >
                      Esqueceu a senha?
                    </Button>
                  </div>
                </form>
              </TabsContent>
          </Tabs>

          <div className="mt-6 pt-6 border-t text-center">
              <p className="text-sm text-gray-600">
                Não tem uma conta?{" "}
                <Button
                  variant="link"
                  className="text-orange-600 p-0 h-auto"
                  onClick={() => navigate("/register", { state: { defaultTab: activeTab } })}
                >
                  Cadastre-se
                </Button>
              </p>
          </div>
        </Card>

        {/* Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Assistência rodoviária 24/7</p>
          <p className="text-xs mt-2">Luanda, Angola</p>
        </div>
      </div>

      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              Digite o email da sua conta para receber um link de redefinição de senha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="recover-email">E-mail</Label>
            <Input
              id="recover-email"
              type="email"
              placeholder="seu@email.com"
              value={forgotPasswordEmail}
              onChange={(e) => setForgotPasswordEmail(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsForgotPasswordOpen(false)} disabled={forgotPasswordLoading}>
              Cancelar
            </Button>
            <Button onClick={handleRecoverPassword} disabled={forgotPasswordLoading}>
              {forgotPasswordLoading ? "Enviando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}