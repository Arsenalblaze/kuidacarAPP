import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ArrowLeft, MapPin, Search } from "lucide-react";
import { RealTimeMap } from "../components/RealTimeMap";
import { toast } from "sonner";

export default function MapTest() {
  const navigate = useNavigate();
  const [searchLocation, setSearchLocation] = useState("");
  const [mapCenter, setMapCenter] = useState<[-8.8383, 13.2344]>([-8.8383, 13.2344]); // Luanda
  const [markers, setMarkers] = useState<Array<{
    id: string;
    name: string;
    address: string;
    position: [number, number];
  }>>([
    {
      id: "1",
      name: "Oficina Central",
      address: "Av. 4 de Fevereiro, Luanda",
      position: [-8.8383, 13.2344]
    },
    {
      id: "2",
      name: "Auto Peças Angola",
      address: "Rua Major Kanhangulo, Luanda",
      position: [-8.845, 13.23]
    }
  ]);

  const handleMapClick = (position: { lat: number; lng: number }) => {
    console.log("Mapa clicado em:", position);
    toast.info(`Localização selecionada: ${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`);
  };

  const handleSearch = () => {
    if (searchLocation.trim()) {
      // Simulação de busca - em produção usaria Geocoding API
      toast.success(`Buscando: ${searchLocation}`);
      // Por enquanto, apenas centraliza no mapa
      setMapCenter([-8.8383, 13.2344]);
    }
  };

  const addMarker = () => {
    const newMarker = {
      id: Date.now().toString(),
      name: `Novo Ponto ${markers.length + 1}`,
      address: "Localização adicionada",
      position: [mapCenter[0] + (Math.random() - 0.5) * 0.01, mapCenter[1] + (Math.random() - 0.5) * 0.01] as [number, number]
    };
    setMarkers([...markers, newMarker]);
    toast.success("Novo marcador adicionado!");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-orange-600 text-white p-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-orange-700 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Teste do Leaflet</h1>
          <div className="w-9" /> {/* Spacer */}
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Search */}
        <Card className="p-4">
          <Label className="text-base mb-3 block">Buscar Localização</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                placeholder="Digite um endereço..."
                className="pl-10"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} variant="outline">
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        {/* Map */}
        <Card className="p-4">
          <Label className="text-base mb-3 block">Mapa Interativo</Label>
          <div className="space-y-3">
            <RealTimeMap
              userLocation={mapCenter}
              nearbyWorkshops={markers}
              height="300px"
              onMapClick={handleMapClick}
            />
            <p className="text-sm text-gray-600">
              Clique no mapa para selecionar uma localização. Os marcadores mostram oficinas próximas e a rota é desenhada automaticamente.
            </p>
          </div>
        </Card>

        {/* Controls */}
        <Card className="p-4">
          <Label className="text-base mb-3 block">Controles do Mapa</Label>
          <div className="space-y-2">
            <Button onClick={addMarker} className="w-full" variant="outline">
              Adicionar Marcador Aleatório
            </Button>
            <Button
              onClick={() => setMapCenter([-8.8383, 13.2344])}
              className="w-full"
              variant="outline"
            >
              Centralizar em Luanda
            </Button>
            <div className="text-sm text-gray-600 mt-2">
              <p><strong>Marcadores atuais:</strong> {markers.length}</p>
              <p><strong>Centro do mapa:</strong> {mapCenter[0].toFixed(4)}, {mapCenter[1].toFixed(4)}</p>
            </div>
          </div>
        </Card>

        {/* Info */}
        <Card className="p-4 bg-blue-50">
          <h3 className="font-semibold text-blue-800 mb-2">Sobre o Mapa</h3>
          <p className="text-sm text-blue-700">
            Esta página demonstra a integração com Leaflet e OpenStreetMap.
            O mapa é totalmente interativo e suporta marcadores, cliques e rotas em tempo real.
          </p>
        </Card>
      </div>
    </div>
  );
}