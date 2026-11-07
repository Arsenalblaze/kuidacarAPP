import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import { Expand, Minimize2, LocateFixed, Navigation } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom marker icons
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const userIcon = createCustomIcon("#2563eb");
const providerDefaultIcon = createCustomIcon("#16a34a");
const workshopDefaultIcon = createCustomIcon("#3b82f6");

interface WorkshopPoint {
  id: string;
  name: string;
  address: string;
  position: [number, number];
}

interface MarkerData {
  position: [number, number];
  title: string;
  icon?: string;
  color?: string;
  popup?: string;
  label?: string;
  onView?: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
}

const getDistanceMeters = (from: [number, number], to: [number, number]) => {
  const earthRadiusMeters = 6371000;
  const dLat = ((to[0] - from[0]) * Math.PI) / 180;
  const dLng = ((to[1] - from[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from[0] * Math.PI) / 180) *
      Math.cos((to[0] * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};

interface MapProps {
  userLocation?: [number, number];
  providerLocation?: [number, number];
  showProvider?: boolean;
  providerPopupText?: string;
  nearbyWorkshops?: WorkshopPoint[];
  routePath?: [number, number][];
  height?: string;
  center?: [number, number];
  zoom?: number;
  markers?: MarkerData[];
  onRouteCalculated?: (distance: string, duration: string, distanceKm?: number, isFallback?: boolean) => void;
  onMapClick?: (position: { lat: number; lng: number }) => void;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    if (map && center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick?: (position: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
}

function MapContent({ userLocation, providerLocation, showProvider, providerPopupText, nearbyWorkshops, markers, routePath, routeLoading }: {
  userLocation: [number, number];
  providerLocation?: [number, number];
  showProvider: boolean;
  providerPopupText?: string;
  nearbyWorkshops?: WorkshopPoint[];
  markers?: MarkerData[];
  routePath?: [number, number][];
  routeLoading?: boolean;
}) {
  const hasUserMarker = (markers || []).some((marker) => marker.icon === "user");

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* User Location Marker */}
      {!hasUserMarker && (
        <Marker position={userLocation} icon={userIcon}>
          <Popup>Sua Localização</Popup>
        </Marker>
      )}
      
      {/* Generic custom markers */}
      {markers?.map((marker, index) => {
        const color = marker.color || (marker.icon === 'user' ? '#2563eb' : marker.icon === 'mechanic' ? '#16a34a' : '#3b82f6');
        const markerIcon = marker.icon === 'user' ? createCustomIcon(color) : createCustomIcon(color);

        return (
          <Marker key={`marker-${index}`} position={marker.position} icon={markerIcon}>
            <Popup>
              <div className="text-sm font-semibold">{marker.title}</div>
              {marker.popup ? <div className="text-xs text-gray-600" dangerouslySetInnerHTML={{ __html: marker.popup }} /> : null}
              {(marker.onView || marker.onSelect) && (
                <div className="mt-2 flex gap-2">
                  {marker.onView && (
                    <button
                      type="button"
                      className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      onClick={marker.onView}
                    >
                      Ver informações
                    </button>
                  )}
                  {marker.onSelect && (
                    <button
                      type="button"
                      className="rounded bg-orange-600 px-2 py-1 text-xs font-medium text-white hover:bg-orange-700 disabled:cursor-default disabled:bg-green-600"
                      onClick={marker.onSelect}
                      disabled={marker.isSelected}
                    >
                      {marker.isSelected ? "Selecionado" : "Selecionar"}
                    </button>
                  )}
                </div>
              )}
            </Popup>
          </Marker>
        );
      })}

      {/* Workshop markers */}
      {nearbyWorkshops?.map((workshop) => (
        <Marker key={workshop.id} position={workshop.position} icon={createCustomIcon(workshop.color || '#3b82f6')}>
          <Popup>
            <div className="text-sm font-semibold">{workshop.name}</div>
            <div className="text-xs text-gray-600">{workshop.address}</div>
          </Popup>
        </Marker>
      ))}

      {routePath && routePath.length >= 2 ? (
        <Polyline
          positions={routePath}
          pathOptions={{
            color: '#2563eb',
            weight: routeLoading ? 4 : 5,
            opacity: 0.95,
            dashArray: routeLoading ? '8 8' : undefined,
          }}
        />
      ) : null}
      
      {/* Provider Location Marker */}
      {showProvider && providerLocation && (
        <Marker position={providerLocation} icon={createCustomIcon('#16a34a')}>
          <Popup>{providerPopupText || 'Prestador a caminho'}</Popup>
        </Marker>
      )}
    </>
  );
}

function MapController({
  isFollowing,
  recenterSignal,
  userLocation,
  providerLocation,
  routePath,
  markers,
  isFullscreen,
}: {
  isFollowing: boolean;
  recenterSignal: number;
  userLocation: [number, number];
  providerLocation?: [number, number];
  routePath?: [number, number][];
  markers?: MarkerData[];
  isFullscreen: boolean;
}) {
  const map = useMap();
  const followLocation = providerLocation || (markers || []).find((marker) => marker.icon === "mechanic")?.position;

  useEffect(() => {
    if (isFullscreen) {
      requestAnimationFrame(() => map.invalidateSize());
      setTimeout(() => map.invalidateSize(), 150);
    }
  }, [isFullscreen, map]);

  useEffect(() => {
    if (recenterSignal > 0) {
      const points = routePath && routePath.length > 1
        ? routePath
        : [userLocation, ...(providerLocation ? [providerLocation] : []), ...((markers || []).map((marker) => marker.position))].filter(Boolean);

      if (points.length > 1) {
        const bounds = L.latLngBounds(points as [number, number][]);
        map.fitBounds(bounds, { padding: [36, 36] });
      }
    }
  }, [recenterSignal, routePath, userLocation, providerLocation, markers, map]);

  useEffect(() => {
    if (isFollowing && followLocation) {
      map.setView(followLocation, Math.max(map.getZoom(), 14));
    }
  }, [isFollowing, followLocation, map]);

  return null;
}

export function RealTimeMap({
  userLocation = [-8.8383, 13.2344], // Centro de Luanda
  providerLocation,
  showProvider = false,
  providerPopupText,
  nearbyWorkshops,
  routePath,
  height = "300px",
  center,
  zoom = 13,
  markers = [],
  onRouteCalculated,
  onMapClick,
}: MapProps) {
  const routeFetchController = useRef<AbortController | null>(null);
  const lastRouteKeyRef = useRef<string>("");
  const [fetchedRoutePath, setFetchedRoutePath] = useState<[number, number][] | undefined>(undefined);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeFailed, setRouteFailed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);

  // Validações para coordenadas
  const isValidCoordinate = (coord: [number, number] | undefined): coord is [number, number] => {
    return coord !== undefined &&
           coord.length === 2 &&
           typeof coord[0] === 'number' &&
           typeof coord[1] === 'number' &&
           !isNaN(coord[0]) &&
           !isNaN(coord[1]) &&
           coord[0] !== 0 &&
           coord[1] !== 0 &&
           coord[0] >= -90 && coord[0] <= 90 && // Latitude válida
           coord[1] >= -180 && coord[1] <= 180; // Longitude válida
  };

  const validUserLocation = isValidCoordinate(userLocation) ? userLocation : [-8.8383, 13.2344];
  const validProviderLocation = isValidCoordinate(providerLocation) ? providerLocation : undefined;
  const trackedMechanicLocation = validProviderLocation || (markers || []).find((marker) => marker.icon === "mechanic")?.position;
  const validRoutePath = routePath && routePath.length >= 2 && routePath.every(coord => isValidCoordinate(coord)) ? routePath : undefined;
  const actualRoutePath = validRoutePath ?? (validProviderLocation ? [validUserLocation, validProviderLocation] : undefined);
  const routePathToRender = fetchedRoutePath && fetchedRoutePath.length >= 2
    ? fetchedRoutePath
    : !routeFailed && validRoutePath && validRoutePath.length >= 2
      ? validRoutePath
      : undefined;

  useEffect(() => {
    if (!actualRoutePath || actualRoutePath.length < 2) {
      setFetchedRoutePath(undefined);
      setRouteLoading(false);
      setRouteFailed(false);
      lastRouteKeyRef.current = "";
      return;
    }

    const routeKey = actualRoutePath.map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join("|");
    if (routeKey === lastRouteKeyRef.current) {
      return;
    }

    lastRouteKeyRef.current = routeKey;
    setFetchedRoutePath(undefined);
    setRouteFailed(false);
    if (routeFetchController.current) {
      routeFetchController.current.abort();
    }

    const controller = new AbortController();
    routeFetchController.current = controller;
    setRouteLoading(true);

    const osrmPath = actualRoutePath.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${osrmPath}?overview=full&geometries=geojson&annotations=distance,duration`;

    const fetchRoute = async () => {
      try {
        const response = await fetch(osrmUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`OSRM request failed with status ${response.status}`);
        }

        const data = await response.json();
        const route = data.routes?.[0];
        if (route?.geometry?.coordinates && Array.isArray(route.geometry.coordinates)) {
          const osrmCoordinates = route.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
          );
          setFetchedRoutePath(osrmCoordinates);
          setRouteLoading(false);

          const distanceKm = route.distance / 1000;
          const durationMinutes = Math.max(1, Math.round(route.duration / 60));
          const distance = `${distanceKm.toFixed(1)} km`;
          const duration = `${durationMinutes} min`;

          onRouteCalculated?.(distance, duration, distanceKm, false);
          return;
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("Falha ao buscar rota OSRM:", error);
        setFetchedRoutePath(undefined);
        setRouteLoading(false);
        setRouteFailed(true);
      }

      if (controller.signal.aborted) return;
      const fallbackDistanceKm = getDistanceMeters(actualRoutePath[0], actualRoutePath[actualRoutePath.length - 1]) / 1000;
      const fallbackDurationMinutes = Math.max(1, Math.round((fallbackDistanceKm / 40) * 60));
      const fallbackDistance = `${fallbackDistanceKm.toFixed(1)} km`;
      const fallbackDuration = `${fallbackDurationMinutes} min`;
      onRouteCalculated?.(fallbackDistance, fallbackDuration, fallbackDistanceKm, true);

      setRouteLoading(false);
      setRouteFailed(true);
    };

    fetchRoute();

    return () => {
      controller.abort();
      routeFetchController.current = null;
    };
  }, [actualRoutePath, onRouteCalculated]);

  // Usar Leaflet (padrão)
  return (
    <div
      className={isFullscreen ? "fixed inset-0 z-[9999] bg-white" : "relative rounded-lg overflow-hidden shadow-lg z-0"}
      style={{ height: isFullscreen ? "100vh" : height, width: isFullscreen ? "100vw" : "100%" }}
    >
      <div className="absolute right-4 top-3 z-[500] flex flex-wrap items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsFullscreen((current) => !current)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-lg backdrop-blur-sm transition hover:bg-white"
          title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setRecenterSignal((value) => value + 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-lg backdrop-blur-sm transition hover:bg-white"
          title="Centralizar rota"
          aria-label="Centralizar rota"
        >
          <LocateFixed className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setIsFollowing((current) => !current)}
          disabled={!trackedMechanicLocation}
          className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur-sm transition ${
            isFollowing
              ? "border-orange-500 bg-orange-500 text-white hover:bg-orange-600"
              : "border-slate-200 bg-white/90 text-slate-700 hover:bg-white"
          } ${!trackedMechanicLocation ? "cursor-not-allowed opacity-50" : ""}`}
          title="Seguir rota do mecânico"
          aria-label="Seguir rota do mecânico"
        >
          <Navigation className="h-4 w-4" />
        </button>
      </div>

      <MapContainer
        center={center ?? validUserLocation}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <MapUpdater center={center ?? validUserLocation} />
        <MapController
          isFollowing={isFollowing}
          recenterSignal={recenterSignal}
          userLocation={validUserLocation}
          providerLocation={validProviderLocation}
          routePath={routePathToRender}
          markers={markers}
          isFullscreen={isFullscreen}
        />
        <MapClickHandler onMapClick={onMapClick} />
        <MapContent
          userLocation={validUserLocation}
          providerLocation={validProviderLocation}
          showProvider={showProvider}
          providerPopupText={providerPopupText}
          nearbyWorkshops={nearbyWorkshops}
          markers={markers}
          routePath={routePathToRender}
          routeLoading={routeLoading}
        />
      </MapContainer>
    </div>
  );
}