import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../layouts/AdminLayout";
import { Card } from "../components/ui/card";
import { apiClient } from "../utils/api";
import { RealTimeMap } from "../components/RealTimeMap";
import { Map, Loader2 } from "lucide-react";

interface ProviderLocation {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  providerType?: string;
  location: {
    lat: number;
    lng: number;
  };
  isOnline: boolean;
}

export const AdminMapPage = () => {
  const [providers, setProviders] = useState<ProviderLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number]>([-8.8383, 13.2344]);

  useEffect(() => {
    const loadProviderLocations = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.getAllProviderLocations();
        if (!response.success) {
          setError("Não foi possível carregar as localizações dos mecânicos.");
          setProviders([]);
          return;
        }

        const availableProviders = response.providers || [];
        setProviders(availableProviders);

        if (availableProviders.length > 0) {
          const firstLocation = availableProviders[0].location;
          setCenter([firstLocation.lat, firstLocation.lng]);
        }
      } catch (err: any) {
        setError(err?.message || "Erro ao buscar os mecânicos.");
        setProviders([]);
      } finally {
        setLoading(false);
      }
    };

    loadProviderLocations();
  }, []);

  const markers = useMemo(
    () =>
      providers.map((provider) => ({
        position: [provider.location.lat, provider.location.lng] as [number, number],
        title: `${provider.name} (${provider.providerType || 'Mecânico'})`,
        popup: `Estado: ${provider.isOnline ? 'Conectado' : 'Desconectado'}<br/>Telefone: ${provider.phone || 'não informado'}`,
        icon: 'mechanic',
        color: provider.isOnline ? '#16a34a' : '#6b7280',
      })),
    [providers]
  );

  return (
    <AdminLayout title="Mapa" subtitle="Visualizar mecânicos em tempo real">
      <div className="space-y-6">
        <Card className="bg-slate-900 border-slate-700 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-200">
                <Map className="w-5 h-5" />
                <span className="font-semibold">OpenStreetMap com localização dos mecânicos</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                As localizações são carregadas do banco e exibidas no mapa. Clique no marcador para ver detalhes.
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400">Mecânicos encontrados</p>
              <p className="text-2xl font-semibold text-white">{providers.length}</p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="h-[560px] bg-slate-900/5">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-slate-400" />
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center px-6 py-10 text-center text-sm text-red-300">
                {error}
              </div>
            ) : providers.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 py-10 text-center text-sm text-slate-400">
                Nenhum mecânico com localização disponível foi encontrado.
              </div>
            ) : (
              <RealTimeMap
                center={center}
                zoom={11}
                markers={markers}
                height="100%"
              />
            )}
          </div>
        </Card>

        {providers.length > 0 && (
          <Card className="p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((provider) => (
                <div key={provider.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                  <p className="text-base font-semibold text-white">{provider.name}</p>
                  <p className="text-xs text-slate-400">{provider.providerType || 'Mecânico'}</p>
                  <p className="mt-3 text-sm text-slate-300">Telefone: {provider.phone || 'não informado'}</p>
                  <p className="text-sm text-slate-300">E-mail: {provider.email || 'não informado'}</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Estado: <span className={provider.isOnline ? 'text-emerald-400' : 'text-slate-400'}>{provider.isOnline ? 'Conectado' : 'Desconectado'}</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-300">Lat: {provider.location.lat.toFixed(5)} | Lng: {provider.location.lng.toFixed(5)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};
