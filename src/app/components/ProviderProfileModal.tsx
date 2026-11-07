import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Phone,
  MessageCircle,
  Star,
  Wrench,
  Truck,
  MapPin,
  Check,
  X,
} from "lucide-react";
import ReviewsList from "./ReviewsList";
import StarRating from "./StarRating";

interface Provider {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  providerType?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  rating?: number;
  totalReviews?: number;
}

interface ProviderProfileModalProps {
  provider: Provider | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (provider: Provider) => void;
  onChat?: (provider: Provider) => void;
}

export function ProviderProfileModal({
  provider,
  isOpen,
  onClose,
  onSelect,
  onChat,
}: ProviderProfileModalProps) {
  if (!provider) return null;

  const [avg, setAvg] = useState<number | null>(provider.rating ?? null);
  const [total, setTotal] = useState<number>(provider.totalReviews || 0);

  useEffect(() => {
    let mounted = true;
    const loadStats = async () => {
      try {
        if (!provider?.id) return;
        const res: any = await (await import('../utils/api')).apiClient.getMechanicRatingStats(provider.id);
        if (!mounted) return;
        if (res && res.success) {
          setAvg(Number(res.average) || 0);
          setTotal(Number(res.total) || 0);
        }
      } catch (err) {
        console.warn('Erro ao buscar estatísticas de avaliação do prestador:', err);
      }
    };

    loadStats();
    return () => { mounted = false; };
  }, [provider?.id]);

  const renderStars = (rating: number = 5) => {
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < Math.round(rating)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
        <span className="text-sm font-semibold ml-2">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Perfil do Prestador</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Profile Header */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={provider.avatar} alt={provider.name} />
              <AvatarFallback>{provider.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-lg font-bold">{provider.name}</h2>
              <p className="text-sm text-gray-600">{provider.providerType}</p>
              <div className="mt-2">{renderStars(provider.rating || 5)}</div>
            </div>
          </div>

          <Card className="p-4 bg-gradient-to-r from-blue-50 to-blue-100">
            <div className="space-y-3">
              {/* Phone */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600">Telefone</p>
                  <p className="font-semibold">{provider.phone}</p>
                </div>
              </div>

              {/* Service Type */}
              {provider.providerType && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                    <Wrench className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600">Especialidade</p>
                    <p className="font-semibold">{provider.providerType}</p>
                  </div>
                </div>
              )}

              {/* Vehicle Info */}
              {provider.vehicleModel && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                    <Truck className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-600">Veículo</p>
                    <p className="font-semibold">
                      {provider.vehicleModel} - {provider.vehiclePlate}
                    </p>
                  </div>
                </div>
              )}

              {/* Reviews Count */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                  <Star className="w-5 h-5 text-yellow-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600">Avaliações</p>
                  <p className="font-semibold">
                    {provider.totalReviews || 0} avaliações
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-green-100 text-green-700 border-0">
              ✓ Verificado
            </Badge>
            <Badge className="bg-blue-100 text-blue-700 border-0">
              ⭐ Top Avaliado
            </Badge>
          </div>

          {/* Tabs for more info */}
          <Tabs defaultValue="about" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="about">Sobre</TabsTrigger>
              <TabsTrigger value="reviews">Avaliações</TabsTrigger>
            </TabsList>
            <TabsContent value="about" className="text-sm text-gray-600">
              <div className="mt-3 space-y-2">
                <p>📍 Atendimento na região de Luanda</p>
                <p>⏰ Disponível 24/7</p>
                <p>✅ Profissional certificado e experiente</p>
                <p>🚗 Equipamento completo em seu veículo</p>
              </div>
            </TabsContent>
            <TabsContent value="reviews" className="text-sm">
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StarRating value={avg ?? 0} readOnly size={18} />
                      <div className="text-sm font-semibold">{(avg ?? 0).toFixed(1)}</div>
                    </div>
                    <div className="text-sm text-gray-600">{total} avaliações</div>
                  </div>

                  <div className="pt-3">
                    <ReviewsList mechanicId={provider.id} initialLimit={5} />
                  </div>
                </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={() => onChat && onChat(provider)}
            className="gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Chat
          </Button>
          <Button
            className="bg-orange-600 hover:bg-orange-700 gap-2"
            onClick={() => onSelect && onSelect(provider)}
          >
            <Check className="w-4 h-4" />
            Selecionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
