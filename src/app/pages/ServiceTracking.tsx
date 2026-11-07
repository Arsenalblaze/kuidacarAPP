import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { RealTimeMap } from "../components/RealTimeMap";
import { ChatModal } from "../components/ChatModal";
import {
  ArrowLeft,
  MapPin,
  Phone,
  MessageCircle,
  Star,
  Clock,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "../utils/api";
import { useAuth } from "../context/AuthContext";

interface ServiceRequest {
  id: string;
  type: string;
  description: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  providerLocation?: {
    lat: number;
    lng: number;
  };
  estimatedPrice: number;
  status: string;
  customerId: string;
  providerId?: string;
  createdAt: string;
}

interface ProviderProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "provider";
  providerType?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  avatar?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
}

export default function ServiceTracking() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<"searching" | "matched" | "onway" | "arrived" | "completed">("searching");
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [providerHistory, setProviderHistory] = useState<ServiceRequest[]>([]);
  const [customerLocation, setCustomerLocation] = useState<[number, number] | null>(null);
  const [providerLocation, setProviderLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previousStatus, setPreviousStatus] = useState<string | null>(null);
  const [simulationInterval, setSimulationInterval] = useState<number | null>(null);
  const [chatModalOpen, setChatModalOpen] = useState(false);

  // Simulate provider movement when on the way
  const startProviderSimulation = (targetLocation: [number, number]) => {
    if (simulationInterval) {
      clearInterval(simulationInterval);
    }

    const interval = setInterval(() => {
      setProviderLocation(prev => {
        if (!prev) return targetLocation;

        const [currentLat, currentLng] = prev;
        const [targetLat, targetLng] = targetLocation;

        // Move gradually towards target
        const latDiff = targetLat - currentLat;
        const lngDiff = targetLng - currentLng;
        const step = 0.0001; // Small movement step

        const newLat = currentLat + Math.sign(latDiff) * Math.min(Math.abs(latDiff), step);
        const newLng = currentLng + Math.sign(lngDiff) * Math.min(Math.abs(lngDiff), step);

        // Add small random variation for realism
        const randomVariation = 0.00005;
        return [
          newLat + (Math.random() - 0.5) * randomVariation,
          newLng + (Math.random() - 0.5) * randomVariation,
        ];
      });
    }, 2000); // Update every 2 seconds

    setSimulationInterval(interval);
  };

  // Stop simulation when component unmounts or status changes
  useEffect(() => {
    return () => {
      if (simulationInterval) {
        clearInterval(simulationInterval);
      }
    };
  }, [simulationInterval]);

  const mapRequestStatus = (requestStatus: string) => {
    switch (requestStatus) {
      case "accepted":
        return "matched" as const;
      case "onway":
        return "onway" as const;
      case "arrived":
        return "arrived" as const;
      case "completed":
        return "completed" as const;
      default:
        return "searching" as const;
    }
  };

  const nearbyWorkshops: { id: string; name: string; address: string; position: [number, number] }[] = [
    {
      id: 'workshop_1',
      name: 'Oficina São Jorge',
      address: 'Av. 4 de Fevereiro, 1200',
      position: [-8.8345, 13.2290],
    },
    {
      id: 'workshop_2',
      name: 'Auto Service Luanda',
      address: 'Rua da Missão, 34',
      position: [-8.8420, 13.2380],
    },
    {
      id: 'workshop_3',
      name: 'Mecânica Rápida',
      address: 'Marginal de Luanda, 560',
      position: [-8.8450, 13.2220],
    },
  ];

  const loadRequest = async () => {
    if (!id) {
      setError("ID da solicitação ausente");
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.getServiceRequest(id);
      if (!response.success) {
        throw new Error("Solicitação não encontrada");
      }

      setRequest(response.request);
      setCustomerLocation([response.request.location.lat, response.request.location.lng]);
      const newStatus = mapRequestStatus(response.request.status);
      if (previousStatus && previousStatus !== newStatus) {
        toast.success(`Status atualizado: ${newStatus === "matched" ? "Aceito" : newStatus === "onway" ? "A caminho" : newStatus === "arrived" ? "Chegou" : "Concluído"}`);
      }
      setPreviousStatus(newStatus);
      setStatus(newStatus);

      if (response.request.providerLocation) {
        setProviderLocation([
          response.request.providerLocation.lat,
          response.request.providerLocation.lng,
        ]);
      }

      if (response.request.providerId) {
        const providerResponse = await apiClient.getUserById(response.request.providerId);
        if (providerResponse.success && providerResponse.user) {
          setProvider(providerResponse.user);

          const historyResponse = await apiClient.getUserServices(providerResponse.user.id);
          if (historyResponse.success && Array.isArray(historyResponse.requests)) {
            setProviderHistory(historyResponse.requests.filter((service: ServiceRequest) => service.providerId === providerResponse.user.id));
          }

          if (!response.request.providerLocation && providerResponse.user.location) {
            setProviderLocation([providerResponse.user.location.lat, providerResponse.user.location.lng]);
          }
        }
      } else {
        setProvider(null);
        setProviderHistory([]);
      }

      if (!response.request.providerLocation && (newStatus === 'onway' || newStatus === 'arrived')) {
        const customerCoords: [number, number] = [response.request.location.lat, response.request.location.lng];
        if (!providerLocation) {
          const startLat = response.request.location.lat + 0.01;
          const startLng = response.request.location.lng + 0.01;
          setProviderLocation([startLat, startLng]);
        }
        startProviderSimulation(customerCoords);
      } else if (newStatus === 'completed' && simulationInterval) {
        clearInterval(simulationInterval);
        setSimulationInterval(null);
      }
    } catch (fetchError: any) {
      console.error("❌ Erro ao carregar solicitação de serviço:", fetchError);
      setError(fetchError.message || "Erro ao carregar a solicitação");
      toast.error(`❌ ${fetchError.message || "Erro ao carregar a solicitação"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequest();
    const interval = setInterval(() => {
      loadRequest();
    }, 5000);

    return () => clearInterval(interval);
  }, [id]);

  // Atualização adicional para localização do prestador em tempo real
  useEffect(() => {
    if (!provider || !request || status !== 'onway') return;

    const locationInterval = setInterval(async () => {
      try {
        // Tentar obter localização GPS real do prestador
        if (navigator.geolocation && status === 'onway') {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const newLocation: [number, number] = [
                position.coords.latitude,
                position.coords.longitude,
              ];
              setProviderLocation(newLocation);

              // Se estiver próximo do destino, mudar status para arrived
              if (customerLocation) {
                const distance = Math.sqrt(
                  Math.pow(newLocation[0] - customerLocation[0], 2) +
                  Math.pow(newLocation[1] - customerLocation[1], 2)
                );
                if (distance < 0.001) { // ~100 metros
                  setStatus('arrived');
                }
              }
            },
            (error) => {
              console.warn("GPS não disponível, usando simulação:", error.message);
              // Fallback para simulação se GPS falhar
              if (!providerLocation) {
                const customerLocation: [number, number] = [request.location.lat, request.location.lng];
                const startLat = request.location.lat + 0.01;
                const startLng = request.location.lng + 0.01;
                setProviderLocation([startLat, startLng]);
                startProviderSimulation(customerLocation);
              }
            },
            {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 10000
            }
          );
        } else {
          // Simulação se GPS não estiver disponível
          if (!providerLocation) {
            const customerLocation: [number, number] = [request.location.lat, request.location.lng];
            const startLat = request.location.lat + 0.01;
            const startLng = request.location.lng + 0.01;
            setProviderLocation([startLat, startLng]);
            startProviderSimulation(customerLocation);
          }
        }
      } catch (error) {
        console.error("Erro ao atualizar localização:", error);
      }
    }, 3000);

    return () => clearInterval(locationInterval);
  }, [provider, request, status, providerLocation, customerLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Carregando solicitação...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        Erro: {error}
      </div>
    );
  }

  const getStatusInfo = () => {
    switch (status) {
      case "searching":
        return { text: "Procurando prestador...", color: "bg-yellow-500" };
      case "matched":
        return { text: provider ? "Prestador encontrado!" : "Aguardando atribuição", color: "bg-green-500" };
      case "onway":
        return { text: "A caminho", color: "bg-blue-500" };
      case "arrived":
        return { text: "Chegou ao local", color: "bg-purple-500" };
      case "completed":
        return { text: "Serviço concluído", color: "bg-gray-500" };
      default:
        return { text: "Aguardando", color: "bg-gray-400" };
    }
  };

  const statusInfo = getStatusInfo();
  const eta = 12;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-orange-600 text-white p-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="text-white hover:bg-orange-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Acompanhamento</h1>
            <p className="text-sm text-orange-100">Pedido #{id}</p>
          </div>
        </div>
      </div>

      {/* Map Placeholder */}
      <div className="relative h-64 bg-gradient-to-br from-blue-100 to-green-100">
        <RealTimeMap 
          userLocation={customerLocation ?? [-8.8383, 13.2344]}
          providerLocation={providerLocation ?? undefined}
          showProvider={!!providerLocation}
          nearbyWorkshops={nearbyWorkshops}
          height="256px"
          routePath={customerLocation && providerLocation ? [customerLocation, providerLocation] : undefined}
        />
        
        {/* Status Badge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <Badge className={`${statusInfo.color} text-white px-4 py-2 text-sm`}>
            {statusInfo.text}
          </Badge>
        </div>

        {/* ETA Badge */}
        {status === "onway" && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <Card className="px-4 py-2 shadow-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-600" />
                <span className="font-semibold">{eta} min</span>
                <span className="text-sm text-gray-600">de distância</span>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto p-6 space-y-4">
        {provider ? (
          <Card className="p-4">
            <div className="flex items-start gap-4 mb-4">
              <Avatar className="w-16 h-16">
                <AvatarImage
                  src={provider.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop"}
                  alt={provider.name}
                />
                <AvatarFallback>{provider.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <h3 className="font-semibold text-lg">{provider.name}</h3>
                <div className="flex items-center gap-1 mb-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">4.7</span>
                  <span className="text-sm text-gray-600">(avaliação em breve)</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Wrench className="w-4 h-4" />
                  <span>{provider.providerType || "Tipo de serviço não informado"}</span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  <p>{provider.vehicleModel || "Modelo do veículo não informado"}</p>
                  <p>{provider.vehiclePlate || "Placa não informada"}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => toast.info("Iniciando chamada...")}
                className="flex items-center gap-2"
              >
                <Phone className="w-4 h-4" />
                Ligar
              </Button>
              <Button
                variant="outline"
                onClick={() => setChatModalOpen(true)}
                className="flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Mensagem
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-4 text-center">
            <p className="text-gray-700 font-medium">Nenhum prestador foi atribuído ainda.</p>
            <p className="text-sm text-gray-600 mt-2">
              A solicitação foi enviada para os prestadores cadastrados. Aguarde até alguém aceitar.
            </p>
          </Card>
        )}

        {/* Service Details */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Detalhes do Serviço</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Wrench className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Tipo de Serviço</p>
                <p className="font-medium">{request?.type || "-"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Localização</p>
                <p className="font-medium">{request?.location.address || "-"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Solicitado</p>
                <p className="font-medium">{request ? new Date(request.createdAt).toLocaleString() : "-"}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Nearby Workshops */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Oficinas Próximas</h3>
            <span className="text-xs text-gray-500">Atualizadas no mapa</span>
          </div>
          <div className="space-y-3">
            {nearbyWorkshops.map((workshop) => (
              <div key={workshop.id} className="rounded-lg border border-gray-200 p-3">
                <p className="font-medium">{workshop.name}</p>
                <p className="text-sm text-gray-600">{workshop.address}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Provider History */}
        {provider && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Histórico do Prestador</h3>
              <span className="text-xs text-gray-500">
                {providerHistory.length} serviço{providerHistory.length === 1 ? '' : 's'}
              </span>
            </div>
            {providerHistory.length > 0 ? (
              <div className="space-y-3">
                {providerHistory.slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                    <p className="text-sm font-medium">{item.type}</p>
                    <p className="text-sm text-gray-600">{item.status}</p>
                    <p className="text-sm text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">Ainda não há histórico de serviços desse prestador.</p>
            )}
          </Card>
        )}

        {/* Timeline */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Progresso</h3>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <div className="w-0.5 h-8 bg-green-500"></div>
              </div>
              <div className="flex-1">
                <p className="font-medium">Solicitação recebida</p>
                <p className="text-sm text-gray-600">14:35</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${status !== "searching" ? "bg-green-500" : "bg-gray-300"}`}></div>
                {status !== "completed" && <div className={`w-0.5 h-8 ${status !== "searching" ? "bg-green-500" : "bg-gray-300"}`}></div>}
              </div>
              <div className="flex-1">
                <p className="font-medium">Prestador encontrado</p>
                {status !== "searching" && <p className="text-sm text-gray-600">14:37</p>}
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${status === "onway" || status === "arrived" ? "bg-green-500" : "bg-gray-300"}`}></div>
                {status !== "completed" && <div className={`w-0.5 h-8 ${status === "onway" || status === "arrived" ? "bg-green-500" : "bg-gray-300"}`}></div>}
              </div>
              <div className="flex-1">
                <p className="font-medium">A caminho</p>
                {(status === "onway" || status === "arrived" || status === "completed") && <p className="text-sm text-gray-600">14:38</p>}
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${status === "arrived" || status === "completed" ? "bg-green-500" : "bg-gray-300"}`}></div>
              </div>
              <div className="flex-1">
                <p className="font-medium">Chegou ao local</p>
                {(status === "arrived" || status === "completed") && <p className="text-sm text-gray-600">14:46</p>}
              </div>
            </div>
          </div>
        </Card>

        {/* Cancel Button */}
        {status !== "completed" && status !== "arrived" && (
          <Button
            variant="outline"
            className="w-full text-red-600 border-red-600 hover:bg-red-50"
            onClick={() => {
              toast.success("Serviço cancelado");
              navigate("/");
            }}
          >
            Cancelar Solicitação
          </Button>
        )}
      </div>

      {/* Chat Modal */}
      {chatModalOpen && request && provider && (
        <ChatModal
          requestId={request.id}
          currentUserId={user?.id || ""}
          otherUserId={provider.id || ""}
          otherUserName={provider.name || "Prestador"}
          otherUserAvatar={provider.avatar}
          isProvider={false}
          onClose={() => setChatModalOpen(false)}
        />
      )}
    </div>
  );
}