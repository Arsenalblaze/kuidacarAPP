import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  ArrowLeft,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Star,
  Calendar,
} from "lucide-react";

interface HistoryItem {
  id: string;
  type: string;
  location: string;
  date: string;
  time: string;
  status: "completed" | "cancelled";
  price: string;
  providerName: string;
  rating?: number;
}

const mockHistory: HistoryItem[] = [
  {
    id: "1",
    type: "Troca de Pneu",
    location: "Av. 4 de Fevereiro, Marginal",
    date: "2026-03-19",
    time: "14:35",
    status: "completed",
    price: "12.000 Kz",
    providerName: "Carlos Silva",
    rating: 5,
  },
  {
    id: "2",
    type: "Bateria",
    location: "Rua Rainha Ginga, 234",
    date: "2026-03-15",
    time: "09:20",
    status: "completed",
    price: "15.000 Kz",
    providerName: "Roberto Santos",
    rating: 4,
  },
  {
    id: "3",
    type: "Reboque",
    location: "Via Expressa, km 15",
    date: "2026-03-10",
    time: "18:45",
    status: "cancelled",
    price: "28.000 Kz",
    providerName: "José Oliveira",
  },
  {
    id: "4",
    type: "Chave Trancada",
    location: "Belas Shopping",
    date: "2026-03-05",
    time: "16:10",
    status: "completed",
    price: "10.000 Kz",
    providerName: "Ana Costa",
    rating: 5,
  },
  {
    id: "5",
    type: "Combustível",
    location: "Rua Amílcar Cabral, 2000",
    date: "2026-02-28",
    time: "22:30",
    status: "completed",
    price: "8.000 Kz",
    providerName: "Marcos Pereira",
    rating: 4,
  },
];

export default function History() {
  const navigate = useNavigate();

  const completedServices = mockHistory.filter((item) => item.status === "completed");
  const cancelledServices = mockHistory.filter((item) => item.status === "cancelled");

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const renderServiceCard = (item: HistoryItem) => (
    <Card key={item.id} className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{item.type}</h3>
            {item.status === "completed" ? (
              <Badge className="bg-green-600 text-white">
                <CheckCircle className="w-3 h-3 mr-1" />
                Concluído
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="w-3 h-3 mr-1" />
                Cancelado
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-600">{item.providerName}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-green-600">{item.price}</p>
          {item.rating && (
            <div className="flex items-center gap-1 mt-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${
                    i < item.rating!
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin className="w-4 h-4" />
          <span>{item.location}</span>
        </div>
        <div className="flex items-center gap-4 text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(item.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{item.time}</span>
          </div>
        </div>
      </div>

      {item.status === "completed" && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3"
          onClick={() => navigate(`/tracking/${item.id}`)}
        >
          Ver Detalhes
        </Button>
      )}
    </Card>
  );

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
          <h1 className="text-xl font-semibold">Histórico de Serviços</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-orange-600">{mockHistory.length}</p>
            <p className="text-xs text-gray-600">Total</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{completedServices.length}</p>
            <p className="text-xs text-gray-600">Concluídos</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-gray-600">{cancelledServices.length}</p>
            <p className="text-xs text-gray-600">Cancelados</p>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="completed">Concluídos</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {mockHistory.length === 0 ? (
              <Card className="p-8 text-center">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Nenhum serviço solicitado ainda</p>
              </Card>
            ) : (
              mockHistory.map(renderServiceCard)
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedServices.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Nenhum serviço concluído</p>
              </Card>
            ) : (
              completedServices.map(renderServiceCard)
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            {cancelledServices.length === 0 ? (
              <Card className="p-8 text-center">
                <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Nenhum serviço cancelado</p>
              </Card>
            ) : (
              cancelledServices.map(renderServiceCard)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}