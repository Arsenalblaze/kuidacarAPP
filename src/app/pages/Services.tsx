import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { apiClient, DEFAULT_SERVICE_CATALOG } from "../utils/api";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  ArrowLeft,
  Truck,
  Wrench,
  Timer,
  Battery,
  Fuel,
  Key,
  User,
  ChevronRight,
  Car,
} from "lucide-react";
import { toast } from "sonner";

const iconMap: Record<string, any> = {
  truck: Truck,
  reboque: Truck,
  wrench: Wrench,
  mecanica: Wrench,
  timer: Timer,
  pneus: Car,
  car: Car,
  battery: Battery,
  bateria: Battery,
  fuel: Fuel,
  combustivel: Fuel,
  key: Key,
  chaveiro: Key,
};

const isImageIcon = (iconValue?: string) => {
  if (!iconValue) return false;
  return iconValue.startsWith('data:image/') || /^https?:\/\//i.test(iconValue);
};

export default function Services() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [services, setServices] = useState(DEFAULT_SERVICE_CATALOG);

  useEffect(() => {
    const loadServices = async () => {
      const response = await apiClient.getServiceCatalog();
      if (response.success && Array.isArray(response.services) && response.services.length > 0) {
        setServices(response.services);
      }
    };

    loadServices();
  }, []);

  const handleServiceSelect = (serviceId: string) => {
    console.log("🎯 Selecionando serviço:", serviceId);
    console.log("👤 Usuário autenticado:", isAuthenticated);
    console.log("👤 Dados do usuário:", user);

    if (!isAuthenticated || !user) {
      console.log("❌ Usuário não autenticado, redirecionando para login");
      toast.error("Você precisa estar logado para solicitar um serviço");
      navigate("/login");
      return;
    }

    console.log("✅ Usuário autenticado, navegando para solicitação");
    // Navega para a página de solicitação com o serviço pré-selecionado
    navigate(`/request?service=${serviceId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <div className="bg-orange-600 text-white p-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-white hover:bg-orange-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Escolha o Serviço</h1>
              <p className="text-sm text-orange-100">
                Selecione o tipo de assistência que você precisa
              </p>
            </div>
          </div>
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/profile")}
              className="text-white hover:bg-orange-700"
            >
              <User className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Info Card */}
        <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Car className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">
                Atendimento 24/7 em Luanda
              </h3>
              <p className="text-sm text-blue-700">
                Prestadores verificados chegam até você em minutos. Preços estimados incluem mão de obra.
              </p>
            </div>
          </div>
        </Card>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {services.map((service) => {
            const iconValue = String(service.icon || service.id || '').toLowerCase();
            const Icon = iconMap[iconValue] || Wrench;
            const shouldRenderImage = isImageIcon(String(service.icon || ''));
            return (
              <Card
                key={service.id}
                className="p-5 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-orange-300"
                onClick={() => handleServiceSelect(service.id)}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`${service.color || 'bg-orange-500'} p-2 rounded-xl overflow-hidden`}>
                    {shouldRenderImage ? (
                      <img
                        src={service.icon}
                        alt={service.name}
                        className="w-8 h-8 object-cover rounded-md"
                      />
                    ) : (
                      <Icon className="w-6 h-6 text-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{service.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{service.description}</p>

                    {/* Info Tags */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-700">
                        ⏱️ {service.estimatedTime || '30-60 min'}
                      </span>
                      <span className="text-xs bg-green-100 px-2 py-1 rounded-full text-green-700 font-medium">
                        💰 {Number(service.price || 0).toLocaleString('pt-AO')} Kz
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </Card>
            );
          })}
        </div>

        {/* Emergency Button */}
        <Card className="p-5 bg-red-50 border-red-200">
          <div className="text-center">
            <h3 className="font-semibold text-red-900 mb-2">Emergência?</h3>
            <p className="text-sm text-red-700 mb-4">
              Se você estiver em uma situação de perigo, ligue para a emergência oficial
            </p>
            <Button
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => toast.info("Ligue 112 para emergências oficiais")}
            >
              📞 Ligar para Emergência (112)
            </Button>
          </div>
        </Card>

        {/* Bottom Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Todos os prestadores são verificados e avaliados</p>
          <p className="text-xs mt-2">Pagamento após conclusão do serviço</p>
        </div>
      </div>
    </div>
  );
}
