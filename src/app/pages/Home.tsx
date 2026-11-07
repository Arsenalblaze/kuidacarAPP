import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { apiClient } from "../utils/api";
import { Car, Wrench, Clock, User, Phone } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [isConnectionWarningOpen, setIsConnectionWarningOpen] = useState(false);
  const [supportContact, setSupportContact] = useState<{ name: string; phone: string }>({ name: "", phone: "" });
  const isCustomer = user?.role === "customer" || user?.role === "client";
  const isProvider = user?.role === "provider";
  const isAdminOrSuperAdmin = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    let isMounted = true;

    const checkInternetConnection = async () => {
      try {
        const result = await apiClient.debugConnection();
        if (!isMounted) return;

        if (!result?.success) {
          setIsConnectionWarningOpen(true);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("❌ Falha na verificação de conexão inicial:", error);
        setIsConnectionWarningOpen(true);
      }
    };

    checkInternetConnection();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    apiClient.getPublicSupportContact().then((response) => {
      if (isMounted && response.success) {
        setSupportContact(response.contact);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleNeedHelp = () => {
    if (isProvider || isAdminOrSuperAdmin) {
      toast.error("Não pode acessar esta área enquanto estiver logado como mecânico ou administrador.");
      return;
    }
    navigate("/services");
  };

  const handleProvider = () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { defaultTab: "provider" } });
      return;
    }

    if (isCustomer || isAdminOrSuperAdmin) {
      toast.error("Não pode acessar esta área enquanto estiver logado como cliente ou administrador.");
      return;
    }

    navigate("/provider");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <div className="bg-orange-600 text-white p-6 pb-12">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Car className="w-10 h-10" />
              <h1 className="text-3xl font-bold">KuidaCar</h1>
            </div>
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                {isAdminOrSuperAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => navigate("/admin")}
                    className="border-white/40 bg-white/5 text-white hover:bg-white/10"
                  >
                    Entrar no Painel Admin
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/profile")}
                  className="text-white hover:bg-orange-700"
                >
                  <User className="w-6 h-6" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => navigate("/login", { state: { defaultTab: "customer" } })}
                  className="text-white hover:bg-orange-700"
                >
                  Entrar
                </Button>
              </div>
            )}
          </div>
          <p className="text-orange-100">Assistência rodoviária rápida e confiável</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-6 -mt-8">
        {/* Quick Actions */}
        <Card className="p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Como você deseja usar?</h2>
          
          <div className="space-y-3">
            <Button
              onClick={handleNeedHelp}
              disabled={isProvider || isAdminOrSuperAdmin}
              className={`w-full h-auto py-4 bg-orange-600 ${isProvider || isAdminOrSuperAdmin ? "opacity-70 cursor-not-allowed" : "hover:bg-orange-700"} flex items-start gap-4`}
            >
              <Car className="w-6 h-6 mt-1 flex-shrink-0" />
              <div className="text-left flex-1">
                <div className="font-semibold text-base">Preciso de Ajuda</div>
                <div className="text-sm text-orange-100 font-normal">
                  Solicitar assistência rodoviária
                </div>
              </div>
            </Button>

            <Button
              onClick={handleProvider}
              variant="outline"
              disabled={isCustomer || isAdminOrSuperAdmin}
              className={`w-full h-auto py-4 border-2 flex items-start gap-4 ${isCustomer || isAdminOrSuperAdmin ? "opacity-70 cursor-not-allowed" : "hover:bg-accent hover:text-accent-foreground"}`}
            >
              <Wrench className="w-6 h-6 mt-1 flex-shrink-0" />
              <div className="text-left flex-1">
                <div className="font-semibold text-base">Sou Prestador</div>
                <div className="text-sm text-gray-600 font-normal">
                  Oferecer serviços de assistência
                </div>
              </div>
            </Button>
          </div>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-4 text-center">
            <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <p className="text-sm font-medium">Atendimento Rápido</p>
          </Card>
          
          <Card className="p-4 text-center">
            <User className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <p className="text-sm font-medium">Profissionais Verificados</p>
          </Card>
          
          <Card className="p-4 text-center">
            <Car className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <p className="text-sm font-medium">Rastreamento em Tempo Real</p>
          </Card>
        </div>

      </div>

      <Dialog open={isConnectionWarningOpen} onOpenChange={setIsConnectionWarningOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conexão indisponível</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Não tem conexão à internet. Verifique a sua conexão à internet.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setIsConnectionWarningOpen(false)} className="bg-orange-600 hover:bg-orange-700">
                Entendi
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Info */}
      <div className="max-w-md mx-auto px-6 py-8">
        <div className="text-center text-sm text-gray-600 mb-6">
          <p>Disponível 24/7 para emergências</p>
          <p className="text-xs mt-2">Serviços de reboque, troca de pneu, bateria e mais</p>
        </div>
        {(supportContact.name || supportContact.phone) && (
          <Card className="p-4 text-center">
            <p className="font-semibold text-gray-900">Contacto KuidaCar</p>
            {supportContact.name && <p className="mt-1 text-sm text-gray-700">{supportContact.name}</p>}
            {supportContact.phone && (
              <a
                href={`tel:${supportContact.phone.replace(/[^\d+]/g, "")}`}
                className="mt-2 inline-flex items-center justify-center gap-2 text-sm font-medium text-orange-700 hover:text-orange-800"
              >
                <Phone className="h-4 w-4" />
                {supportContact.phone}
              </a>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}