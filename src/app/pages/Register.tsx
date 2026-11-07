import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../utils/api";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Car, Wrench, Users, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"customer" | "provider">("customer");
  const [emailCooldown, setEmailCooldown] = useState(0);

  useEffect(() => {
    const defaultTab = (location.state as any)?.defaultTab;
    if (defaultTab === "provider") {
      setActiveTab("provider");
    } else if (defaultTab === "customer") {
      setActiveTab("customer");
    }
  }, [location.state]);

  const [customerData, setCustomerData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [providerData, setProviderData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    providerType: "",
    vehicleModel: "",
    vehiclePlate: "",
    documentType: "",
    documentUrl: "",
  });

  const [adminData, setAdminData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const isAdminVisible = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // If admin tab is hidden, ensure activeTab is not 'admin'
  useEffect(() => {
    if (!isAdminVisible && activeTab === 'admin') {
      setActiveTab('customer');
    }
  }, [isAdminVisible, activeTab]);

  const handleAdminRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (adminData.password !== adminData.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (adminData.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      try {
        const emailExists = await apiClient.isEmailRegistered(adminData.email);
        if (emailExists) {
          toast.error("Este email já está registado. Faça login ou use outro email.");
          return;
        }
      } catch (error) {
        console.warn("Não foi possível fazer a verificação prévia do e-mail; o Supabase validará durante o registo:", error);
      }

      const result = await register({
        name: adminData.name,
        email: adminData.email,
        phone: adminData.phone,
        password: adminData.password,
        role: "super_admin",
      });

      if (result?.needsConfirmation) {
        if (typeof window !== 'undefined') {
          window.open('https://mail.google.com', '_blank', 'noopener,noreferrer');
        }
        toast.success("✅ Conta criada com sucesso! Visite o seu e-mail para confirmar o cadastro e acesse o Gmail para concluir a confirmação.", { duration: 8000 });
        navigate("/login", { state: { message: "Verifique o seu e-mail para confirmar o cadastro." } });
        return;
      }

      toast.success("✅ Conta criada com sucesso!");
      navigate("/login", { state: { message: "Acesse a sua conta" } });
    } catch (error: any) {
      console.error("Erro no registro de admin:", error);
      toast.error(error.message || "Erro ao criar conta. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (customerData.password !== customerData.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (customerData.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      const exists = await apiClient.isEmailRegistered(customerData.email);
      if (exists) {
        toast.error('Este email já está registado. Faça login ou use outro email.');
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Erro ao verificar email antes do cadastro:', err);
    }

    try {
      const result = await register({
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        password: customerData.password,
        role: "customer",
      });

      if (result?.needsConfirmation) {
        if (typeof window !== 'undefined') {
          window.open('https://mail.google.com', '_blank', 'noopener,noreferrer');
        }
        toast.success("✅ Conta criada com sucesso! Visite o seu e-mail para confirmar o cadastro e acesse o Gmail para concluir a confirmação.", { duration: 8000 });
        navigate("/login", { state: { message: "Verifique o seu e-mail para confirmar o cadastro." } });
        return;
      }

      toast.success("✅ Conta criada com sucesso!");
      navigate("/login", { state: { message: "Acesse a sua conta" } });
    } catch (error: any) {
      console.error("Erro no registro:", error);
      const errorMessage = error.message || "Erro ao criar conta. Tente novamente.";
      
      // Detectar erro de limite de email
      if (errorMessage.includes("Limite de envio de email") || errorMessage.includes("email rate limit")) {
        toast.error(`⏳ ${errorMessage}\n\n💡 Dica: Tente com outro email ou aguarde alguns minutos.`);
        setEmailCooldown(60); // Aguarde 60 segundos
        const interval = setInterval(() => {
          setEmailCooldown(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        toast.error(`❌ ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (providerData.password !== providerData.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (providerData.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (!providerData.documentType) {
      toast.error("Selecione o tipo do documento do prestador");
      return;
    }

    if (!providerData.documentUrl) {
      toast.error("Anexe a imagem do documento do prestador");
      return;
    }

    setIsLoading(true);

    try {
      const exists = await apiClient.isEmailRegistered(providerData.email);
      if (exists) {
        toast.error('Este email já está registado. Faça login ou use outro email.');
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Erro ao verificar email antes do cadastro do prestador:', err);
    }

    try {
      const result = await register({
        name: providerData.name,
        email: providerData.email,
        phone: providerData.phone,
        password: providerData.password,
        role: "provider",
        providerType: providerData.providerType,
        vehicleModel: providerData.vehicleModel,
        vehiclePlate: providerData.vehiclePlate,
        documentType: providerData.documentType,
        documentUrl: providerData.documentUrl,
      });

      if (result?.needsConfirmation) {
        if (typeof window !== 'undefined') {
          window.open('https://mail.google.com', '_blank', 'noopener,noreferrer');
        }
        toast.success("✅ Conta criada com sucesso! Visite o seu e-mail para confirmar o cadastro e acesse o Gmail para concluir a confirmação.", { duration: 8000 });
        navigate("/login", { state: { message: "Verifique o seu e-mail para confirmar o cadastro." } });
        return;
      }

      toast.success("✅ Conta criada com sucesso!");
      navigate("/login", { state: { message: "Acesse a sua conta" } });
    } catch (error: any) {
      console.error("Erro no registro:", error);
      const errorMessage = error.message || "Erro ao criar conta. Tente novamente.";
      
      // Detectar erro de limite de email
      if (errorMessage.includes("Limite de envio de email") || errorMessage.includes("email rate limit")) {
        toast.error(`⏳ ${errorMessage}\n\n💡 Dica: Tente com outro email ou aguarde alguns minutos.`);
        setEmailCooldown(60); // Aguarde 60 segundos
        const interval = setInterval(() => {
          setEmailCooldown(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        toast.error(`❌ ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <div className="bg-orange-600 text-white p-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/login", { state: { defaultTab: activeTab } })}
            className="text-white hover:bg-orange-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Criar Conta</h1>
            <p className="text-sm text-orange-100">Cadastre-se no KuidaCar</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-6 py-6">
        <Card className="p-6 shadow-lg">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "customer" | "provider") }>
            <TabsList className={`grid w-full grid-cols-1 sm:grid-cols-2 gap-2 mb-6`}>
              <TabsTrigger value="customer" className="gap-1 w-full flex items-center py-1">
                <Car className="w-3 h-3" />
                <span className="text-sm">Cliente</span>
              </TabsTrigger>
              <TabsTrigger value="provider" className="gap-1 w-full flex items-center py-1">
                <Wrench className="w-3 h-3" />
                <span className="text-sm">Prestador</span>
              </TabsTrigger>
            </TabsList>

            {/* Customer Register */}
            <TabsContent value="customer">
              <form onSubmit={handleCustomerRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-name">Nome Completo</Label>
                  <Input
                    id="customer-name"
                    type="text"
                    placeholder="João Silva"
                    value={customerData.name}
                    onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-email">E-mail</Label>
                  <Input
                    id="customer-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={customerData.email}
                    onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-phone">Telefone</Label>
                  <Input
                    id="customer-phone"
                    type="tel"
                    placeholder="+244 923 456 789"
                    value={customerData.phone}
                    onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="customer-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={customerData.password}
                      onChange={(e) => setCustomerData({ ...customerData, password: e.target.value })}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-confirm-password">Confirmar Senha</Label>
                  <Input
                    id="customer-confirm-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={customerData.confirmPassword}
                    onChange={(e) => setCustomerData({ ...customerData, confirmPassword: e.target.value })}
                    required
                  />
                </div>

                <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={isLoading || emailCooldown > 0}>
                  {isLoading ? "Cadastrando..." : emailCooldown > 0 ? `Aguarde ${emailCooldown}s` : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>

            {/* Provider Register */}
            <TabsContent value="provider">
              <form onSubmit={handleProviderRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider-name">Nome Completo</Label>
                  <Input
                    id="provider-name"
                    type="text"
                    placeholder="Carlos Mendes"
                    value={providerData.name}
                    onChange={(e) => setProviderData({ ...providerData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider-email">E-mail</Label>
                  <Input
                    id="provider-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={providerData.email}
                    onChange={(e) => setProviderData({ ...providerData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider-phone">Telefone</Label>
                  <Input
                    id="provider-phone"
                    type="tel"
                    placeholder="+244 923 456 789"
                    value={providerData.phone}
                    onChange={(e) => setProviderData({ ...providerData, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider-type">Tipo de Serviço</Label>
                  <select
                    id="provider-type"
                    value={providerData.providerType}
                    onChange={(e) => setProviderData({ ...providerData, providerType: e.target.value })}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Selecione o tipo de serviço</option>
                    <option value="reboque">Reboque</option>
                    <option value="mecanica">Mecânica Geral</option>
                    <option value="pneus">Troca de Pneus</option>
                    <option value="bateria">Bateria</option>
                    <option value="combustivel">Abastecimento</option>
                    <option value="chaveiro">Chaveiro</option>
                    <option value="completo">Serviço Completo</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle-model">Modelo do Veículo</Label>
                  <Input
                    id="vehicle-model"
                    type="text"
                    placeholder="Toyota Hilux 2020"
                    value={providerData.vehicleModel}
                    onChange={(e) => setProviderData({ ...providerData, vehicleModel: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle-plate">Placa do Veículo</Label>
                  <Input
                    id="vehicle-plate"
                    type="text"
                    placeholder="LD-45-23-AB"
                    value={providerData.vehiclePlate}
                    onChange={(e) => setProviderData({ ...providerData, vehiclePlate: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider-document-type">Tipo do Documento</Label>
                  <select
                    id="provider-document-type"
                    value={providerData.documentType}
                    onChange={(e) => setProviderData({ ...providerData, documentType: e.target.value })}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Selecione o documento</option>
                    <option value="identidade">Identidade</option>
                    <option value="cnh">CNH</option>
                    <option value="carteira_motociclista">Carteira de Motociclista</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider-document">Imagem do Documento</Label>
                  <Input
                    id="provider-document"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      if (!file.type.startsWith("image/")) {
                        toast.error("Selecione apenas uma imagem válida para o documento.");
                        return;
                      }

                      const reader = new FileReader();
                      reader.onload = () => {
                        setProviderData((prev) => ({
                          ...prev,
                          documentUrl: String(reader.result || ""),
                        }));
                      };
                      reader.readAsDataURL(file);
                    }}
                    required
                  />
                  {providerData.documentUrl && (
                    <img
                      src={providerData.documentUrl}
                      alt="Pré-visualização do documento"
                      className="mt-2 h-28 w-full rounded-md border object-cover"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="provider-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="•••••••��"
                      value={providerData.password}
                      onChange={(e) => setProviderData({ ...providerData, password: e.target.value })}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider-confirm-password">Confirmar Senha</Label>
                  <Input
                    id="provider-confirm-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={providerData.confirmPassword}
                    onChange={(e) => setProviderData({ ...providerData, confirmPassword: e.target.value })}
                    required
                  />
                </div>

                <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={isLoading || emailCooldown > 0}>
                  {isLoading ? "Cadastrando..." : emailCooldown > 0 ? `Aguarde ${emailCooldown}s` : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>

            {/* Admin registration removed — controlled elsewhere */}
          </Tabs>

          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-sm text-gray-600">
              Já tem uma conta?{" "}
              <Button
                variant="link"
                className="text-orange-600 p-0 h-auto"
                onClick={() => navigate("/login", { state: { defaultTab: activeTab } })}
              >
                Entrar
              </Button>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}