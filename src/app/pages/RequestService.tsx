import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../context/AuthContext";
import { apiClient, DEFAULT_SERVICE_CATALOG, supabase } from "../utils/api";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { RealTimeMap } from "../components/RealTimeMap";
import { ProviderProfileModal } from "../components/ProviderProfileModal";
import { ChatModal } from "../components/ChatModal";
import SupportTicketDetailsModal from "../components/SupportTicketDetailsModal";
import { HelpModal } from "../components/HelpModal";
import BlockRequestModal from "../components/BlockRequestModal";
import BlockedReasonModal from "../components/BlockedReasonModal";
import ReviewPublishedModal from "../components/ReviewPublishedModal";
import RateMechanicModal from "../components/RateMechanicModal";
import { Badge } from "../components/ui/badge";
import { NotificationBell } from "../components/NotificationBell";
import { playMessageSound, useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { usePushNotifications } from "../hooks/usePushNotifications";
import {
  ArrowLeft,
  MapPin,
  Wrench,
  Battery,
  Fuel,
  Car,
  Key,
  Truck,
  User,
  MessageCircle,
  Phone,
  X,
  LogOut,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import StarRating from "../components/StarRating";

const iconMap: Record<string, any> = {
  truck: Truck,
  reboque: Truck,
  car: Car,
  pneus: Car,
  battery: Battery,
  bateria: Battery,
  fuel: Fuel,
  combustivel: Fuel,
  key: Key,
  chaveiro: Key,
  wrench: Wrench,
  mecanica: Wrench,
};

const isImageIcon = (iconValue?: string) => {
  if (!iconValue) return false;
  return iconValue.startsWith('data:image/') || /^https?:\/\//i.test(iconValue);
};

const defaultServiceTypes = DEFAULT_SERVICE_CATALOG.map((service) => ({
  id: service.id,
  name: service.name,
  icon: isImageIcon(String(service.icon || '')) ? null : (iconMap[String(service.icon || service.id).toLowerCase()] || Wrench),
  color: service.color || 'bg-orange-100 text-orange-600',
}));

const serviceTypeLabels: Record<string, string> = Object.fromEntries(
  DEFAULT_SERVICE_CATALOG.map((service) => [service.id, service.name])
);

export default function RequestService() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [serviceCatalog, setServiceCatalog] = useState(DEFAULT_SERVICE_CATALOG);
  const [serviceTypes, setServiceTypes] = useState(defaultServiceTypes);
  const [servicePage, setServicePage] = useState(1);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [searching, setSearching] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [onlineMechanics, setOnlineMechanics] = useState<Array<{
    id: string;
    name: string;
    position: [number, number];
    providerType: string;
    vehicleModel: string;
    vehiclePlate: string;
    status?: string | null;
  }>>([]);
  const [mechanicSearch, setMechanicSearch] = useState("");
  const [mechanicPage, setMechanicPage] = useState(1);
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(null);
  const [selectedMechanicName, setSelectedMechanicName] = useState<string | null>(null);
  const [selectedMechanicPosition, setSelectedMechanicPosition] = useState<[number, number] | null>(null);
  const [liveProviderLocations, setLiveProviderLocations] = useState<Record<string, [number, number]>>({});
  const [mechanicSpeedKmh, setMechanicSpeedKmh] = useState(0);
  const [isMechanicStopped, setIsMechanicStopped] = useState(false);
  const [mechanicRoadDistanceKm, setMechanicRoadDistanceKm] = useState<number | null>(null);
  const [isMechanicRoadRouteUnavailable, setIsMechanicRoadRouteUnavailable] = useState(false);
  const [nearestRoadDistance, setNearestRoadDistance] = useState<string | null>(null);
  const [nearestRoadDuration, setNearestRoadDuration] = useState<string | null>(null);
  const [nearestRouteIsEstimated, setNearestRouteIsEstimated] = useState(false);
  const [lastShownNearestMechanic, setLastShownNearestMechanic] = useState<{ id: string; name: string } | null>(null);
  const [sameNearestMechanicDialogOpen, setSameNearestMechanicDialogOpen] = useState(false);
  const mechanicMovementRef = useRef<{
    position: [number, number];
    sampledAt: number;
    lastMovementAt: number;
    speedKmh: number;
  } | null>(null);
  const routeCoordinatesRef = useRef<{
    customerLocation: { lat: number; lng: number } | null;
    mechanicPosition: [number, number] | null;
  }>({ customerLocation: null, mechanicPosition: null });
  routeCoordinatesRef.current = { customerLocation: currentLocation, mechanicPosition: selectedMechanicPosition };
  const locationMapRef = useRef<HTMLDivElement | null>(null);
  const locationScrollTimeoutRef = useRef<number | null>(null);
  const [routeMode, setRouteMode] = useState(false);
  const [stableRoutePath, setStableRoutePath] = useState<Array<[number, number]> | undefined>(undefined);
  const [viewRequestRoutes, setViewRequestRoutes] = useState<Record<string, Array<[number, number]>> | undefined>(undefined);
  const [selectedProviderProfile, setSelectedProviderProfile] = useState<any>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [chatModalOpenForExisting, setChatModalOpenForExisting] = useState(false);
  const [lastCreatedRequestId, setLastCreatedRequestId] = useState<string | null>(null);
  const [userRequests, setUserRequests] = useState<any[]>([]);
  const [viewExistingRequests, setViewExistingRequests] = useState(false);
  const [selectedRequestForChat, setSelectedRequestForChat] = useState<any>(null);
  const [customerName] = useState<string>("");
  const [unreadRequestIds, setUnreadRequestIds] = useState<Set<string>>(new Set());
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockingRequestId, setBlockingRequestId] = useState<string | null>(null);
  const [blockingTargetUserId, setBlockingTargetUserId] = useState<string | null>(null);
  const [blockedReasonOpen, setBlockedReasonOpen] = useState<boolean>(false);
  const [blockedReasonText, setBlockedReasonText] = useState<string | null>(null);
  const [blockedRequestId, setBlockedRequestId] = useState<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState<boolean>(false);
  const [reviewModalData, setReviewModalData] = useState<{ rating?: number | null; comment?: string | null; mechanicName?: string | null } | null>(null);
  const [rateModalOpen, setRateModalOpen] = useState<boolean>(false);
  const [rateModalRequestId, setRateModalRequestId] = useState<string | null>(null);
  const [rateModalMechanicId, setRateModalMechanicId] = useState<string | null>(null);
  const [rateModalMechanicName, setRateModalMechanicName] = useState<string | null>(null);
  const selectedMechanicTimeoutRef = useRef<number | null>(null);
  const [adminMessagesOpen, setAdminMessagesOpen] = useState(false);
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [loadingAdminMessages, setLoadingAdminMessages] = useState(false);
  const [adminRecipientId, setAdminRecipientId] = useState<string | null>(null);
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<string | null>(null);
  const [showDeleteAllAdminMessagesConfirm, setShowDeleteAllAdminMessagesConfirm] = useState(false);
  const [supportTicketModalOpen, setSupportTicketModalOpen] = useState(false);
  const [supportTicketIdToShow, setSupportTicketIdToShow] = useState<string | null>(null);
  const [openReviewRequestId, setOpenReviewRequestId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>("");
  const [reviewLoading, setReviewLoading] = useState<boolean>(false);
  const [deleteRequestConfirmOpen, setDeleteRequestConfirmOpen] = useState(false);
  const [requestDeleteBlocked, setRequestDeleteBlocked] = useState(false);
  const [requestLifecycleNotice, setRequestLifecycleNotice] = useState<string | null>(null);

  const selectedRequestLocation = useMemo(() => {
    if (!lastCreatedRequestId) return null;
    const req = userRequests.find((r) => String(r.id) === String(lastCreatedRequestId));
    if (!req) return null;
    const loc = req.location || req.providerLocation || req.provider_location || null;
    if (loc && loc.lat && loc.lng) return { lat: Number(loc.lat), lng: Number(loc.lng) };
    return null;
  }, [lastCreatedRequestId, userRequests]);

  // Verificar se usuário está logado ao carregar a página
  useEffect(() => {
    if (!user) {
      console.log("🚫 Usuário não logado, redirecionando para a página principal");
      toast.error("Você precisa estar logado para solicitar serviços");
      navigate("/", { replace: true });
      return;
    }
  }, [user, navigate]);

  // Load admin messages once so we can show/hide the admin messages button
  useEffect(() => {
    if (!user) return;
    fetchAdminMessages().catch(() => {});
  }, [user]);

  useEffect(() => {
    const loadServiceCatalog = async () => {
      const response = await apiClient.getServiceCatalog();
      if (response.success && Array.isArray(response.services) && response.services.length > 0) {
        const catalog = response.services;
        setServiceCatalog(catalog);
        setServiceTypes(catalog.map((service: any) => ({
          id: service.id,
          name: service.name,
          icon: isImageIcon(String(service.icon || '')) ? null : (iconMap[String(service.icon || service.id).toLowerCase()] || Wrench),
          color: service.color || 'bg-orange-100 text-orange-600',
        })));
      }
    };

    loadServiceCatalog();
  }, []);

  useEffect(() => {
    if (!routeMode || !currentLocation || !selectedMechanicPosition) {
      setStableRoutePath(undefined);
      return;
    }

    setStableRoutePath((previousPath) => {
      if (
        previousPath?.[0]?.[0] === selectedMechanicPosition[0] &&
        previousPath?.[0]?.[1] === selectedMechanicPosition[1] &&
        previousPath?.[1]?.[0] === currentLocation.lat &&
        previousPath?.[1]?.[1] === currentLocation.lng
      ) {
        return previousPath;
      }

      return [
        selectedMechanicPosition,
        [currentLocation.lat, currentLocation.lng],
      ];
    });
  }, [routeMode, currentLocation, selectedMechanicPosition]);

  useEffect(() => {
    if (!viewExistingRequests || !currentLocation) {
      setViewRequestRoutes(undefined);
      return;
    }

    const nextRoutes: Record<string, Array<[number, number]>> = {};
    userRequests.forEach((request) => {
      if (request.location?.lat && request.location?.lng) {
        nextRoutes[request.id] = [
          [currentLocation.lat, currentLocation.lng],
          [request.location.lat, request.location.lng],
        ];
      }
    });
    setViewRequestRoutes(nextRoutes);
  }, [viewExistingRequests, currentLocation, userRequests]);

  // Pré-selecionar serviço se vier da página de serviços
  useEffect(() => {
    const serviceFromUrl = searchParams.get("service");
    if (serviceFromUrl) {
      setSelectedService(serviceFromUrl);
    }
  }, [searchParams]);

  // Buscar solicitações do usuário
  useEffect(() => {
    if (user) {
      fetchUserRequests();
      fetchUnreadRequestIds();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel(`unread_messages_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        (payload) => {
          const newRecord = (payload as any).new;
          if (newRecord && newRecord.request_id) {
            setUnreadRequestIds((prev) => new Set(prev).add(newRecord.request_id));
          }
          if (newRecord && String(newRecord.receiver_id) === String(user.id) && String(newRecord.sender_id) !== String(user.id)) {
            playMessageSound();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  // Real-time subscription to detect service request changes for this user
  useEffect(() => {
    if (!user) return;

    const sub = supabase
      .channel(`service_requests_user_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'service_requests', filter: `customer_id=eq.${user.id}` },
        (payload) => {
          try {
            const newRequest = (payload as any).new;
            if (!newRequest) return;

            setUserRequests((prev) => {
              const exists = prev.some((request) => String(request.id) === String(newRequest.id));
              if (exists) return prev;
              return [newRequest, ...prev];
            });
            setLastCreatedRequestId(String(newRequest.id));
            toast.success('Nova solicitação criada e disponível para abertura em tempo real.');
          } catch (err) {
            console.warn('Erro no handler realtime insert service_requests:', err);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_requests', filter: `customer_id=eq.${user.id}` },
        (payload) => {
          try {
            if (!payload.new) return;
            // If the request was blocked and the customer is this user, show modal
            if (payload.new.is_blocked && String(payload.new.customer_id) === String(user.id)) {
              setBlockedReasonText(payload.new.blocked_reason || null);
              setBlockedReasonOpen(true);
              // Remove from user's visible requests
              setUserRequests((prev) => prev.filter((r) => r.id !== payload.new.id));
              toast.info('Sua solicitação foi bloqueada pelo prestador');
            }

            setUserRequests((prev) => {
              const next = [...prev];
              const index = next.findIndex((request) => String(request.id) === String(payload.new.id));
              if (index >= 0) {
                next[index] = { ...next[index], ...payload.new };
                return next;
              }
              return [payload.new, ...next];
            });
          } catch (err) {
            console.warn('Erro no handler realtime update service_requests:', err);
          }
        }
      )
      .subscribe();

    return () => {
      try { sub.unsubscribe(); } catch (_) {}
      try { if (typeof supabase.removeChannel === 'function') supabase.removeChannel(sub); } catch (_) {}
    };
  }, [user]);

  // Realtime: notificar cliente quando sua avaliação for inserida
  useEffect(() => {
    if (!user) return;

    const reviewChannel = supabase
      .channel(`mechanic_reviews_user_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mechanic_reviews', filter: `customer_id=eq.${user.id}` },
        (payload) => {
          try {
            const newRec = (payload as any).new;
            toast.success('Sua avaliação foi publicada com sucesso!');
            // show modal with details
            setReviewModalData({ rating: newRec?.rating || null, comment: newRec?.comment || null, mechanicName: newRec?.mechanic_name || null });
            setReviewModalOpen(true);
            // Atualizar lista de solicitações/estado local
            fetchUserRequests().catch(() => {});
          } catch (err) {
            console.warn('Erro no handler realtime mechanic_reviews (cliente):', err);
          }
        }
      )
      .subscribe();

    return () => {
      try { reviewChannel.unsubscribe(); } catch (_) {}
      try { if (typeof supabase.removeChannel === 'function') supabase.removeChannel(reviewChannel); } catch (_) {}
    };
  }, [user]);

  // render review modal

  // Rate mechanic modal (client initiates)


  // Subscribe to provider status changes in KV store to refresh mechanics list in realtime
  useEffect(() => {
    if (!user) return;
    const sub = supabase
      .channel('providers_status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kv_store_9dc5328a', filter: `key=like.user:%` },
        (payload) => {
          const nextRow = (payload as any)?.new;
          const nextValue = nextRow?.value && typeof nextRow.value === 'object' ? nextRow.value : {};
          const providerId = nextRow?.key ? String(nextRow.key).replace(/^user:/, '') : null;
          const nextStatus = String(nextValue.status || (nextRow?.is_online ? 'available' : 'offline')).toLowerCase();

          if (!providerId || !nextStatus) return;

          const providerLocation = nextRow?.provider_location ||
            nextValue.providerLocation ||
            nextValue.provider_location;
          if (
            providerLocation &&
            Number.isFinite(Number(providerLocation.lat)) &&
            Number.isFinite(Number(providerLocation.lng))
          ) {
            const position: [number, number] = [Number(providerLocation.lat), Number(providerLocation.lng)];
            setLiveProviderLocations((current) => ({ ...current, [providerId]: position }));
            if (String(providerId) === String(selectedMechanicId)) {
              setSelectedMechanicPosition(position);
            }
          }

          setOnlineMechanics((prev) =>
            prev.map((mechanic) =>
              String(mechanic.id) === String(providerId)
                ? { ...mechanic, status: nextStatus }
                : mechanic,
            ),
          );

          fetchOnlineMechanics().catch(() => {});
        }
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, [user, currentLocation, selectedMechanicId]);

  const fetchUserRequests = async () => {
    if (!user) return;

    try {
      const response = await apiClient.getUserServices(user.id);
      if (response.success && response.requests) {
        setUserRequests(response.requests);
        const providerIds = Array.from(new Set(
          response.requests
            .filter((request: any) => {
              const status = String(request.status || '').toLowerCase();
              return !['completed', 'finalized', 'finalizado', 'cancelled', 'canceled', 'rejected'].includes(status);
            })
            .map((request: any) => request.providerId || request.provider_id || request.mechanicId || request.mechanic_id)
            .filter(Boolean)
            .map(String),
        ));
        const locations = await Promise.all(providerIds.map(async (providerId) => {
          const locationResponse = await apiClient.getProviderLocationById(providerId);
          return locationResponse.success && locationResponse.location
            ? [providerId, [locationResponse.location.lat, locationResponse.location.lng] as [number, number]] as const
            : null;
        }));
        setLiveProviderLocations((current) => ({
          ...current,
          ...Object.fromEntries(locations.filter((item): item is NonNullable<typeof item> => item !== null)),
        }));
      }
    } catch (error) {
      console.error("Erro ao buscar solicitações do usuário:", error);
    }
  };

  const stopTrackedRoute = () => {
    setRouteMode(false);
    setViewExistingRequests(false);
    setStableRoutePath(undefined);
    setSelectedMechanicPosition(null);
  };

  const fetchUnreadRequestIds = async () => {
    if (!user) return;

    try {
      const response = await apiClient.getUnreadRequestIdsForUser(user.id);
      if (response.success) {
        setUnreadRequestIds(new Set(response.requestIds));
      }
    } catch (error) {
      console.error('Erro ao buscar mensagens não lidas:', error);
    }
  };

  const fetchAdminMessages = async () => {
    if (!user) return;

    setLoadingAdminMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('receiver_id', user.id)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setAdminMessages(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar mensagens do administrador:', error);
      setAdminMessages([]);
      toast.error(error?.message || 'Erro ao carregar mensagens do administrador.');
    } finally {
      setLoadingAdminMessages(false);
    }
  };

  const resolveAdminRecipientIds = async () => {
    const ids = new Set<string>();

    try {
      const { data: kvData, error: kvError } = await supabase
        .from("kv_store_9dc5328a")
        .select("key, value")
        .like("key", "user:%");

      if (!kvError && kvData) {
        for (const row of kvData as any[]) {
          const value = row.value && typeof row.value === 'object' ? row.value : {};
          const role = String(value.role || '').toLowerCase();
          if (role === 'admin' || role === 'super_admin') {
            const adminId = String(value.id || row.key.replace('user:', ''));
            if (adminId) ids.add(adminId);
          }
        }
      }

      if (kvError) {
        console.warn("Não foi possível localizar administradores no KV:", kvError.message);
      }
    } catch (error) {
      console.warn("Erro ao listar administradores no KV:", error);
    }

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, role")
        .in("role", ["admin", "super_admin"]);

      if (!profileError && profileData) {
        for (const profile of profileData) {
          if (profile?.id) ids.add(String(profile.id));
        }
      }

      if (profileError) {
        console.warn("Não foi possível localizar administradores em profiles:", profileError.message);
      }
    } catch (error) {
      console.warn("Erro ao listar administradores em profiles:", error);
    }

    const resolved = Array.from(ids);
    if (resolved.length > 0) {
      setAdminRecipientId(resolved[0]);
      return resolved;
    }

    const fallback = ['admin-local'];
    setAdminRecipientId(fallback[0]);
    return fallback;
  };

  const resolveAdminRecipientId = async () => {
    const ids = await resolveAdminRecipientIds();
    return ids[0] || 'admin-local';
  };


  const handleOpenAdminMessages = async () => {
    const nextState = !adminMessagesOpen;
    setAdminMessagesOpen(nextState);

    if (nextState) {
      await resolveAdminRecipientId();
      await fetchAdminMessages();
    }
  };

  const adminUnreadCount = adminMessages.filter((m: any) => !m?.is_read).length;

  const clearUnreadForRequest = (requestId: string) => {
    setUnreadRequestIds((prev) => {
      const next = new Set(prev);
      next.delete(requestId);
      return next;
    });
  };

  const handleDeleteCustomerMessage = async (messageId: string) => {
    try {
      await apiClient.deleteMessage(messageId);
      setAdminMessages((current) => current.filter((message) => message.id !== messageId));
      setConfirmDeleteMessageId(null);
      toast.success('Mensagem removida com sucesso.');
    } catch (error: any) {
      console.error('Erro ao remover mensagem do administrador:', error);
      toast.error(error?.message || 'Não foi possível remover a mensagem.');
    }
  };

  const handleDeleteAllCustomerMessages = async () => {
    try {
      if (!user) return;
      await apiClient.deleteAllMessagesForUser(user.id);
      setAdminMessages([]);
      setShowDeleteAllAdminMessagesConfirm(false);
      toast.success('Todas as mensagens foram removidas.');
    } catch (error: any) {
      console.error('Erro ao remover todas as mensagens do administrador:', error);
      toast.error(error?.message || 'Não foi possível remover todas as mensagens.');
    }
  };

  const activeRequestMessage = "Não pode fazer uma solicitação enquanto já estiver a decorrer outra solicitação. Pode ver a solicitação em curso clicando em “Abrir solicitação feita agora”.";

  const makeMechanicAvailable = async (providerId: string) => {
    const response = await apiClient.setProviderStatus(providerId, 'available');
    if (!response.success) {
      throw new Error(response.error || 'Não foi possível disponibilizar o mecânico.');
    }
  };

  const hasActiveServiceRequest = useMemo(() => {
    return userRequests.some((request) => {
      const status = String(request?.status || '').toLowerCase();
      return !['completed', 'finalized', 'finalizado', 'cancelled', 'canceled', 'blocked', 'rejected', 'declined'].includes(status);
    });
  }, [userRequests]);
  const isAwaitingCustomerConfirmation = (status: unknown) =>
    String(status || '').toLowerCase() === 'awaiting_customer_confirmation';
  const lastCreatedRequest = userRequests.find(
    (request) => String(request.id) === String(lastCreatedRequestId),
  );

  const handleNotificationClick = (notification: any) => {
    if ([
      'request_accepted',
      'request_finalized_by_provider',
      'request_deletion_requested',
    ].includes(notification.type)) {
      fetchUserRequests();
      setRouteMode(true);
      setViewExistingRequests(true);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await apiClient.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      toast.success('Notificação eliminada.');
    } catch (error: any) {
      console.error('Erro ao remover notificação:', error);
      toast.error(error?.message || 'Não foi possível remover a notificação.');
    }
  };

  const handleDeleteAllNotifications = async () => {
    try {
      if (!user) return;
      await apiClient.deleteAllNotificationsForUser(user.id);
      setNotifications([]);
      toast.success('Todas as notificações foram eliminadas.');
    } catch (error: any) {
      console.error('Erro ao remover todas as notificações:', error);
      toast.error(error?.message || 'Não foi possível remover todas as notificações.');
    }
  };

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    setNotifications,
  } = useRealtimeNotifications(user?.id ?? null, {
    autoRemindMs: 30000,
    onNewNotification: (notification) => {
      toast.success(notification.message);
      if (notification.type === "request_accepted") {
        fetchUserRequests();
      }
    },
  });

  const {
    isSupported,
    subscription,
    permission,
    requestPermission,
    subscribeToPush,
    sendTestNotification
  } = usePushNotifications(user?.id ?? null);

  useEffect(() => {
    if (isSupported && permission !== 'granted' && permission !== 'denied') {
      const timer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          const shouldPrompt = window.confirm('Deseja ativar notificações push para receber alertas instantâneos?');
          if (shouldPrompt) {
            handleEnablePushNotifications();
          }
        }
      }, 800);

      return () => window.clearTimeout(timer);
    }
  }, [isSupported, permission, user?.id]);

  useEffect(() => {
    return () => {
      if (selectedMechanicTimeoutRef.current) {
        window.clearTimeout(selectedMechanicTimeoutRef.current);
        selectedMechanicTimeoutRef.current = null;
      }
      if (locationScrollTimeoutRef.current) {
        window.clearTimeout(locationScrollTimeoutRef.current);
        locationScrollTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedMechanicId) {
      if (selectedMechanicTimeoutRef.current) {
        window.clearTimeout(selectedMechanicTimeoutRef.current);
        selectedMechanicTimeoutRef.current = null;
      }
      return;
    }

    if (hasActiveServiceRequest) {
      if (selectedMechanicTimeoutRef.current) {
        window.clearTimeout(selectedMechanicTimeoutRef.current);
        selectedMechanicTimeoutRef.current = null;
      }
      return;
    }

    if (selectedMechanicTimeoutRef.current) {
      window.clearTimeout(selectedMechanicTimeoutRef.current);
    }

    const timerId = window.setTimeout(async () => {
      const currentSelectedMechanic = selectedMechanicId;
      const hasRequestForThisMechanic = userRequests.some((request) => {
        const isActive = !['completed', 'finalized', 'finalizado', 'cancelled', 'canceled', 'blocked', 'rejected', 'declined'].includes(String(request?.status || '').toLowerCase());
        return isActive && String(request?.providerId || '') === String(currentSelectedMechanic);
      });

      if (currentSelectedMechanic && !hasRequestForThisMechanic && !hasActiveServiceRequest) {
        try {
          await apiClient.setProviderStatus(currentSelectedMechanic, 'available');
          console.log('⏱️ Mecânico disponibilizado automaticamente após 50s sem solicitação:', currentSelectedMechanic);
        } catch (error) {
          console.warn('Erro ao disponibilizar mecânico após timeout:', error);
        }

        if (selectedMechanicId === currentSelectedMechanic) {
          setSelectedMechanicId(null);
          setSelectedMechanicName(null);
          setSelectedMechanicPosition(null);
          setSelectedProviderProfile(null);
          setStableRoutePath(undefined);
          setRouteMode(false);
        }

        toast.info('O mecânico voltou a ficar disponível porque não houve solicitação em 50 segundos.');
      }
    }, 50000);

    selectedMechanicTimeoutRef.current = timerId;

    return () => {
      if (selectedMechanicTimeoutRef.current) {
        window.clearTimeout(selectedMechanicTimeoutRef.current);
        selectedMechanicTimeoutRef.current = null;
      }
    };
  }, [selectedMechanicId, userRequests, hasActiveServiceRequest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("🔍 Verificando autenticação...");
    console.log("👤 Usuário atual:", user);
    console.log("🔐 Está autenticado:", !!user);
    console.log("🎫 Token atual:", apiClient.getAccessToken()?.substring(0, 30) + '...');

    if (hasActiveServiceRequest) {
      toast.error(activeRequestMessage);
      return;
    }

    if (!selectedService) {
      toast.error("Você deve selecionar um serviço antes de solicitar.");
      return;
    }

    if (!location) {
      toast.error("Informe a sua localização antes de solicitar.");
      return;
    }

    if (!user) {
      console.log("❌ Usuário não autenticado, redirecionando para login");
      toast.error("Você precisa estar logado para solicitar um serviço");
      navigate("/login");
      return;
    }

    console.log("✅ Usuário autenticado, prosseguindo...");

    if (!selectedMechanicId) {
      toast.error("Selecione o mecânico primeiro.");
      return;
    }
    const currentCoords = currentLocation ?? { lat: -8.8383, lng: 13.2344 };
    console.log("📋 Dados da solicitação:", {
      type: selectedService,
      location,
      coords: currentCoords,
      description,
      estimatedPrice: getEstimatedPrice(selectedService),
      providerId: selectedMechanicId,
      mechanicName: selectedMechanicName,
    });

    setSearching(true);
    
    try {
      console.log("📡 Enviando solicitação para API...");
      
      const response: any = await apiClient.createServiceRequest({
        type: selectedService,
        description: description || "Sem descrição",
        location: {
          lat: currentCoords.lat,
          lng: currentCoords.lng,
          address: location,
        },
        estimatedPrice: getEstimatedPrice(selectedService),
        mechanicName: selectedMechanicName || undefined,
        providerId: selectedMechanicId || undefined,
        providerLocation: selectedMechanicPosition
          ? { lat: selectedMechanicPosition[0], lng: selectedMechanicPosition[1] }
          : undefined,
      });

      console.log("📥 Resposta recebida:", response);

      if (response.success) {
        console.log("✅ Solicitação criada com sucesso!");
        setLastCreatedRequestId(response.request?.id);
        toast.success("✅ Solicitação criada! Mostrando rota da sua localização para o mecânico selecionado.");
        if (!currentLocation) {
          try {
            await getCurrentLocation();
          } catch (err) {
            console.warn('Não foi possível obter localização automaticamente:', err);
          }
        }
        setRouteMode(true);

        if (response.request?.id) {
          apiClient.notifyOnlineProvidersOfNewRequest({
            id: response.request.id,
            type: response.request.type,
            description: response.request.description,
            location: response.request.location,
            customerId: user.id,
            customerName: user.name || "Cliente",
            estimatedPrice: response.request.estimatedPrice,
          }).catch((error) => {
            console.warn("Não foi possível notificar prestadores online:", error);
          });
        }
      } else {
        console.log("❌ API retornou erro:", response.error);
        throw new Error(response.error || "Erro ao criar solicitação");
      }
    } catch (error: any) {
      console.error("❌ Erro na solicitação:", error);
      console.error("❌ Detalhes do erro:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      toast.error(`❌ ${error.message || "Erro desconhecido. Tente fazer login novamente."}`);
    } finally {
      setSearching(false);
    }
  };

  const getEstimatedPrice = (serviceType: string): number => {
    const service = serviceCatalog.find((item) => String(item.id) === String(serviceType));
    if (service && Number(service.price) > 0) {
      return Number(service.price);
    }

    const fallbackPrices: Record<string, number> = {
      reboque: 20000,
      mecanica: 15000,
      pneus: 6000,
      bateria: 10000,
      combustivel: 8000,
      chaveiro: 15000,
    };
    return fallbackPrices[serviceType] || 10000;
  };

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const fetchMechanicProfile = async (mechanicId: string) => {
    try {
      const mod = await import('../services/UserProfileKVService');
      const service = mod.default || mod.UserProfileKVService || mod;
      const profile = await service.getCombinedProfile?.(mechanicId);
      if (profile) {
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          providerType: profile.providerType || profile.provider_type,
          vehicleModel: profile.vehicleModel || profile.vehicle_model,
          vehiclePlate: profile.vehiclePlate || profile.vehicle_plate,
          avatar: profile.avatar,
        };
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar perfil do mecânico:', error);
      return null;
    }
  };

  const fetchMechanicPhoneFromKvStore = async (mechanicId: string) => {
    try {
      const mod = await import('../services/UserProfileKVService');
      const service = mod.default || mod.UserProfileKVService || mod;
      const profile = await service.getCombinedProfile?.(mechanicId);
      return profile?.phone || null;
    } catch (error) {
      console.error('Erro ao buscar telefone do mecânico no KV store:', error);
      return null;
    }
  };

  const handleCallMechanic = async (request: any) => {
    if (!request.providerId) {
      toast.error('Nenhum mecânico associado a esta solicitação ainda.');
      return;
    }

    const mechanicProfile = await fetchMechanicProfile(request.providerId);
    if (!mechanicProfile) {
      toast.error('Não foi possível encontrar o contato do mecânico.');
      return;
    }

    if (!mechanicProfile.phone) {
      toast.error('Telefone do mecânico não disponível. Tente pelo chat.');
      return;
    }

    window.location.href = `tel:${mechanicProfile.phone}`;
  };

  const handleEnablePushNotifications = async () => {
    try {
      const result = permission === 'default'
        ? await requestPermission()
        : permission;
      if (result !== 'granted') {
        toast.error('Permissão para notificações negada');
        return;
      }

      if (!subscription) {
        await subscribeToPush();
        toast.success('✅ Notificações push ativadas! Você receberá alertas mesmo com o app fechado.');
      }
    } catch (error) {
      console.error('Erro ao ativar notificações push:', error);
      toast.error('Erro ao ativar notificações push');
    }
  };

  const handleTestNotification = async () => {
    try {
      await sendTestNotification();
      toast.success('Notificação de teste enviada!');
    } catch (error) {
      console.error('Erro ao enviar notificação de teste:', error);
      toast.error('Erro ao enviar notificação de teste');
    }
  };

  const getRouteSummary = (from: { lat: number; lng: number }, to: [number, number]) => {
    const earthRadiusKm = 6371;
    const dLat = toRadians(to[0] - from.lat);
    const dLng = toRadians(to[1] - from.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(from.lat)) *
        Math.cos(toRadians(to[0])) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadiusKm * c;
    const estimatedMinutes = Math.max(1, Math.round((distance / 40) * 60));

    return {
      distance: `${distance.toFixed(1)} km`,
      duration: `${estimatedMinutes} min`,
    };
  };

  const getDistanceKmBetweenPoints = (from: { lat: number; lng: number }, to: [number, number]) => {
    const earthRadiusKm = 6371;
    const dLat = toRadians(to[0] - from.lat);
    const dLng = toRadians(to[1] - from.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(from.lat)) *
        Math.cos(toRadians(to[0])) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  };

  const isMechanicAtCustomer = (request: any) => {
    const providerId = request?.providerId || request?.provider_id || request?.mechanicId || request?.mechanic_id;
    const mechanicLocation = liveProviderLocations[String(providerId || '')] ||
      (String(providerId || '') === String(selectedMechanicId || '') ? selectedMechanicPosition : null) ||
      request?.providerLocation ||
      request?.provider_location ||
      null;
    const customerLocation = request?.location;
    if (!mechanicLocation || !customerLocation) return false;

    const lat = Number(customerLocation.lat);
    const lng = Number(customerLocation.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !lat || !lng) return false;

    return getDistanceKmBetweenPoints({ lat, lng }, mechanicLocation) <= 0.001;
  };

  const isSelectedMechanicAtCustomer = () => {
    const activeRequest = userRequests.find((request) => String(request.id) === String(lastCreatedRequestId));
    const destination = activeRequest?.location || currentLocation;
    return Boolean(
      destination &&
      selectedMechanicPosition &&
      getDistanceKmBetweenPoints(destination, selectedMechanicPosition) <= 0.001,
    );
  };

  const getMechanicTravelDuration = () => {
    if (isMechanicStopped) return 'Parado';
    if (mechanicRoadDistanceKm === null) {
      return isMechanicRoadRouteUnavailable ? 'Rota indisponível' : 'Calculando...';
    }

    const estimatedSpeedKmh = mechanicSpeedKmh > 0 ? mechanicSpeedKmh : 40;
    const remainingMinutes = Math.max(1, Math.ceil((mechanicRoadDistanceKm / estimatedSpeedKmh) * 60));
    return `${remainingMinutes} min`;
  };

  const [mechanicArrivalNotified, setMechanicArrivalNotified] = useState(false);

  useEffect(() => {
    if (!routeMode || !currentLocation || !selectedMechanicPosition || mechanicArrivalNotified) return;

    const distanceKm = getDistanceKmBetweenPoints(currentLocation, selectedMechanicPosition);
    if (distanceKm <= 0.001) {
      const timeoutId = window.setTimeout(() => {
        toast.success('Seu mecânico chegou!');
        setMechanicArrivalNotified(true);
      }, 4000);

      return () => window.clearTimeout(timeoutId);
    }
  }, [routeMode, currentLocation, selectedMechanicPosition, mechanicArrivalNotified]);

  const reverseGeocodeCoordinates = async (lat: number, lng: number, fallbackAddress?: string) => {
    const geocodingUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(geocodingUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return fallbackAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }

      const data = await response.json();
      return data?.display_name || fallbackAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error: any) {
      console.warn('⚠️ Erro ao converter coordenadas para endereço:', error?.message || error);
      return fallbackAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const resolveLocationTextToAddress = async (value: string) => {
    if (!value || typeof value !== 'string') return value;

    const normalized = value.trim().replace(/[\[\]()]/g, '');
    if (!normalized) return value;

    const parts = normalized.split(/[\s,;]+/).filter(Boolean);
    if (parts.length !== 2) return value;

    const [first, second] = parts.map(Number);
    if ([first, second].some((n) => Number.isNaN(n))) return value;

    const isFirstLat = first >= -90 && first <= 90;
    const isSecondLat = second >= -90 && second <= 90;
    const isFirstLng = first >= -180 && first <= 180;
    const isSecondLng = second >= -180 && second <= 180;

    let lat: number | null = null;
    let lng: number | null = null;

    if (isFirstLat && isSecondLng && !isSecondLat) {
      lat = first;
      lng = second;
    } else if (isSecondLat && isFirstLng && !isFirstLat) {
      lat = second;
      lng = first;
    } else if (isFirstLat && isSecondLng && isSecondLat && isFirstLng) {
      const isLikelyLngFirst = Math.abs(first) > 90;
      lat = isLikelyLngFirst ? second : first;
      lng = isLikelyLngFirst ? first : second;
    } else {
      return value;
    }

    if (lat === null || lng === null) return value;

    const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    return reverseGeocodeCoordinates(lat, lng, fallbackAddress);
  };

  useEffect(() => {
    if (!location) return;

    let isMounted = true;

    const convertIfNeeded = async () => {
      const candidate = location.trim();
      const parts = candidate.replace(/[\[\]()]/g, '').split(/[\s,;]+/).filter(Boolean);
      const isCoordinateText = parts.length === 2 && parts.every((part) => !Number.isNaN(Number(part)));

      if (!isCoordinateText) return;

      const resolved = await resolveLocationTextToAddress(candidate);
      if (isMounted && resolved && resolved !== candidate) {
        setLocation(resolved);
      }
    };

    void convertIfNeeded();

    return () => {
      isMounted = false;
    };
  }, [location]);

  const getCurrentLocation = async () => {
    if (isGettingLocation) {
      return;
    }

    if (!navigator.geolocation) {
      toast.error("Geolocalização não é suportada pelo seu navegador");
      return;
    }

    setIsGettingLocation(true);
    const loadingToastId = "location-loading";
    toast.loading("Obtendo sua localização...", { id: loadingToastId });

    try {
      console.log("📍 Solicitando permissão de geolocalização...");
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000,
        });
      });

      const { latitude, longitude } = position.coords;
      console.log("📍 Coordenadas obtidas da geolocalização:", { latitude, longitude });

      const address = await reverseGeocodeCoordinates(latitude, longitude, `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      console.log("📍 Localização real obtida:", { lat: latitude, lng: longitude, address });

      setLocation(address);
      setCurrentLocation({ lat: latitude, lng: longitude });
      setShowLocationMap(true);
      if (locationScrollTimeoutRef.current) {
        window.clearTimeout(locationScrollTimeoutRef.current);
      }
      locationScrollTimeoutRef.current = window.setTimeout(() => {
        const mapElement = locationMapRef.current;
        if (mapElement) {
          const mapTop = window.scrollY + mapElement.getBoundingClientRect().top;
          window.scrollTo({ top: mapTop + 111, behavior: "smooth" });
        }
        locationScrollTimeoutRef.current = null;
      }, 2000);

      toast.success("Localização obtida com sucesso!", { id: loadingToastId });

    } catch (error: any) {
      console.error("❌ Erro na geolocalização:", error);
      console.error("❌ Detalhes do erro:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      });

      let errorMessage = "Erro ao obter localização";

      if (error.code !== undefined) {
        // Erro da Geolocation API
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Permissão de localização negada. Permita o acesso à localização no navegador e tente novamente.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Localização indisponível. Verifique sua conexão e GPS.";
            break;
          case error.TIMEOUT:
            errorMessage = "Timeout ao obter localização. Verifique sua conexão e tente novamente.";
            break;
          default:
            errorMessage = `Erro de geolocalização (${error.code}): ${error.message}`;
        }
      } else {
        // Outro tipo de erro (rede, geocoding, etc.)
        if (error.name === 'AbortError') {
          errorMessage = "Timeout na requisição de geocoding. Tente novamente.";
        } else if (error.message.includes('Geocoding API error')) {
          errorMessage = "Erro na API de geocoding. Verifique sua conexão com a internet.";
        } else if (error.message.includes('fetch')) {
          errorMessage = "Erro de rede ao obter endereço. Verifique sua conexão com a internet.";
        } else {
          errorMessage = `Erro ao processar localização: ${error.message}`;
        }
      }

      toast.error(errorMessage, { id: loadingToastId });
    } finally {
      setIsGettingLocation(false);
    }
  };

  useEffect(() => {
    if (currentLocation && !isGettingLocation) {
      fetchOnlineMechanics();
    }
  }, [currentLocation, isGettingLocation]);

  useEffect(() => {
    if (!routeMode || !selectedMechanicId) {
      mechanicMovementRef.current = null;
      setMechanicSpeedKmh(0);
      setIsMechanicStopped(false);
      return;
    }

    const now = Date.now();
    mechanicMovementRef.current = selectedMechanicPosition
      ? { position: selectedMechanicPosition, sampledAt: now, lastMovementAt: now, speedKmh: 0 }
      : null;
    setMechanicSpeedKmh(0);
    setIsMechanicStopped(true);
  }, [routeMode, selectedMechanicId]);

  useEffect(() => {
    if (!routeMode || !selectedMechanicId) {
      setMechanicRoadDistanceKm(null);
      setIsMechanicRoadRouteUnavailable(false);
      return;
    }

    setMechanicRoadDistanceKm(null);
    setIsMechanicRoadRouteUnavailable(false);

    let activeController: AbortController | null = null;
    const fetchRoadDistance = async () => {
      const { customerLocation: customer, mechanicPosition } = routeCoordinatesRef.current;
      if (!customer || !mechanicPosition) return;

      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 10000);
      const coordinates = `${mechanicPosition[1]},${mechanicPosition[0]};${customer.lng},${customer.lat}`;

      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`OSRM request failed with status ${response.status}`);
        }

        const data = await response.json();
        const distanceMeters = data.routes?.[0]?.distance;
        if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
          throw new Error('OSRM did not return a valid road distance');
        }

        setMechanicRoadDistanceKm(distanceMeters / 1000);
        setIsMechanicRoadRouteUnavailable(false);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('Falha ao calcular a distância pela rota:', error);
          setIsMechanicRoadRouteUnavailable(true);
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    void fetchRoadDistance();
    const interval = window.setInterval(() => {
      void fetchRoadDistance();
    }, 15000);

    return () => {
      window.clearInterval(interval);
      activeController?.abort();
    };
  }, [routeMode, selectedMechanicId]);

  useEffect(() => {
    if (!routeMode) return;

    const interval = setInterval(async () => {
      // Atualizar a localização atualizada do mecânico no kv_store
      if (selectedMechanicId) {
        try {
          const response = await apiClient.getProviderLocationById(selectedMechanicId);
          if (response.success && response.location) {
            const newPosition: [number, number] = [
              response.location.lat,
              response.location.lng
            ];
            const now = Date.now();
            const previousSample = mechanicMovementRef.current;

            if (!previousSample) {
              mechanicMovementRef.current = {
                position: newPosition,
                sampledAt: now,
                lastMovementAt: now,
                speedKmh: 0,
              };
              setIsMechanicStopped(true);
              setMechanicSpeedKmh(0);
            } else {
              const distanceKm = getDistanceKmBetweenPoints(
                { lat: previousSample.position[0], lng: previousSample.position[1] },
                newPosition,
              );
              const elapsedHours = (now - previousSample.sampledAt) / (60 * 60 * 1000);

              if (distanceKm >= 0.012 && elapsedHours > 0) {
                const measuredSpeedKmh = distanceKm / elapsedHours;
                const smoothedSpeedKmh = previousSample.speedKmh > 0
                  ? previousSample.speedKmh * 0.5 + measuredSpeedKmh * 0.5
                  : measuredSpeedKmh;
                mechanicMovementRef.current = {
                  position: newPosition,
                  sampledAt: now,
                  lastMovementAt: now,
                  speedKmh: smoothedSpeedKmh,
                };
                setMechanicSpeedKmh(smoothedSpeedKmh);
                setIsMechanicStopped(false);
              } else {
                const isStopped = now - previousSample.lastMovementAt >= 15000;
                mechanicMovementRef.current = {
                  position: newPosition,
                  sampledAt: now,
                  lastMovementAt: previousSample.lastMovementAt,
                  speedKmh: isStopped ? 0 : previousSample.speedKmh,
                };
                if (isStopped) {
                  setMechanicSpeedKmh(0);
                  setIsMechanicStopped(true);
                }
              }
            }

            setSelectedMechanicPosition(newPosition);
            console.log('📍 Localização do mecânico atualizada:', newPosition);
          }
        } catch (error) {
          console.warn('⚠️ Erro ao buscar localização do mecânico:', error);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [routeMode, selectedMechanicId]);

  const SERVICES_PER_PAGE = 9;

  const totalServicePages = Math.max(1, Math.ceil(serviceTypes.length / SERVICES_PER_PAGE));
  const currentServicePage = Math.min(servicePage, totalServicePages);
  const pagedServiceTypes = useMemo(() => {
    const start = (currentServicePage - 1) * SERVICES_PER_PAGE;
    return serviceTypes.slice(start, start + SERVICES_PER_PAGE);
  }, [currentServicePage, serviceTypes]);

  useEffect(() => {
    setServicePage(1);
  }, [serviceTypes.length]);

  const filteredMechanics = useMemo(() => {
    const term = mechanicSearch.trim().toLowerCase();
    if (!term) {
      return onlineMechanics;
    }

    return onlineMechanics.filter((mechanic) =>
      mechanic.name.toLowerCase().includes(term)
    );
  }, [mechanicSearch, onlineMechanics]);

  const rankedAvailableMechanics = useMemo(() => {
    if (!currentLocation) return null;

    const availableMechanics = onlineMechanics.filter((mechanic) => {
      const status = String(mechanic.status || 'available').toLowerCase();
      return status === 'available' || status === 'online' ||
        (mechanic.id === selectedMechanicId && status === 'occupied');
    });

    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const distanceInKm = (position: [number, number]) => {
      const [latitude, longitude] = position;
      const latDifference = toRadians(latitude - currentLocation.lat);
      const lngDifference = toRadians(longitude - currentLocation.lng);
      const haversine =
        Math.sin(latDifference / 2) ** 2 +
        Math.cos(toRadians(currentLocation.lat)) *
          Math.cos(toRadians(latitude)) *
          Math.sin(lngDifference / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    };

    return availableMechanics
      .map((mechanic) => ({ mechanic, distance: distanceInKm(mechanic.position) }))
      .sort((first, second) => first.distance - second.distance);
  }, [currentLocation, onlineMechanics, selectedMechanicId]);

  const nearestMechanic = rankedAvailableMechanics?.[0] || null;
  const nextNearestMechanic = rankedAvailableMechanics?.find(
    ({ mechanic }) => mechanic.id !== nearestMechanic?.mechanic.id,
  ) || null;

  useEffect(() => {
    if (!user?.id) {
      setLastShownNearestMechanic(null);
      return;
    }

    try {
      const saved = window.localStorage.getItem(`kuidacar:last-nearest-mechanic:${user.id}`);
      const parsed: unknown = saved ? JSON.parse(saved) : null;
      if (
        parsed &&
        typeof parsed === "object" &&
        "id" in parsed &&
        typeof parsed.id === "string" &&
        "name" in parsed &&
        typeof parsed.name === "string"
      ) {
        setLastShownNearestMechanic({ id: parsed.id, name: parsed.name });
      } else {
        setLastShownNearestMechanic(null);
      }
    } catch (error) {
      console.error("Não foi possível carregar o último mecânico recomendado:", error);
      setLastShownNearestMechanic(null);
    }
  }, [user?.id]);

  const displayedMechanicPosition = selectedMechanicPosition || nearestMechanic?.mechanic.position || null;
  const displayedMechanicId = selectedMechanicPosition
    ? selectedMechanicId
    : nearestMechanic?.mechanic.id;

  useEffect(() => {
    setNearestRoadDistance(null);
    setNearestRoadDuration(null);
    setNearestRouteIsEstimated(false);
  }, [nearestMechanic?.mechanic.id, currentLocation?.lat, currentLocation?.lng]);

  const totalMechanicPages = Math.max(1, Math.ceil(filteredMechanics.length / 6));
  const currentMechanicPage = Math.min(mechanicPage, totalMechanicPages);
  const pagedMechanics = useMemo(() => {
    const start = (currentMechanicPage - 1) * 6;
    return filteredMechanics.slice(start, start + 6);
  }, [currentMechanicPage, filteredMechanics]);

  useEffect(() => {
    setMechanicPage(1);
  }, [mechanicSearch]);

  const fetchOnlineMechanics = async () => {
    try {
      console.log("🔧 Buscando mecânicos online...");
      if (!currentLocation) {
        console.warn("Sem localização atual, não é possível buscar mecânicos.");
        return;
      }

      // Pequeno delay para evitar conflitos de renderização
      await new Promise(resolve => setTimeout(resolve, 100));

      const response: any = await apiClient.getNearbyProviders(currentLocation);

      if (!response.success) {
        throw new Error(response.message || "Erro ao buscar prestadores");
      }

      const providers = response.providers?.map((provider: any) => {
        const position = provider.location
          ? [provider.location.lat, provider.location.lng] as [number, number]
          : [currentLocation.lat + 0.002, currentLocation.lng + 0.002] as [number, number];

        return {
          id: provider.id,
          name: provider.name,
          position,
          providerType: serviceTypeLabels[provider.providerType] || provider.providerType || "Prestador",
          vehicleModel: provider.vehicleModel || "Não disponível",
          vehiclePlate: provider.vehiclePlate || "--",
          status: provider.status || null,
        };
      }) || [];

      // Atualizar estado de forma segura
      setOnlineMechanics(providers);
      console.log("✅ Mecânicos online encontrados:", providers.length);
    } catch (error) {
      console.error("❌ Erro ao buscar mecânicos online:", error);
      // Não mostrar toast de erro para evitar conflitos adicionais
      console.warn("Falha ao buscar mecânicos próximos - continuando sem eles");
    }
  };

  const selectMechanic = async (mechanic: (typeof onlineMechanics)[number]): Promise<boolean> => {
    const previousSelectedMechanicId = selectedMechanicId;

    try {
      const statusResp: any = await apiClient.getProviderStatus(mechanic.id);
      if (statusResp?.success === false) {
        throw new Error(statusResp.error || 'Não foi possível verificar o status do mecânico.');
      }
      if (statusResp.status === 'occupied' && previousSelectedMechanicId !== mechanic.id) {
        toast.error('Mecânico ocupado');
        await fetchOnlineMechanics();
        return false;
      }

      const statusUpdate = await apiClient.setProviderStatus(mechanic.id, 'occupied');
      if (!statusUpdate.success) {
        throw new Error(statusUpdate.error || 'Não foi possível marcar o mecânico como ocupado.');
      }

      if (previousSelectedMechanicId && previousSelectedMechanicId !== mechanic.id) {
        const previousStatusUpdate = await apiClient.setProviderStatus(previousSelectedMechanicId, 'available');
        if (!previousStatusUpdate.success) {
          console.warn('Não foi possível liberar o mecânico anteriormente selecionado:', previousStatusUpdate.error);
        }
      }

      setSelectedMechanicId(mechanic.id);
      setSelectedMechanicName(mechanic.name);
      setSelectedMechanicPosition(mechanic.position);

      const mechanicProfile = await fetchMechanicProfile(mechanic.id);
      setSelectedProviderProfile({
        id: mechanic.id,
        name: mechanic.name,
        providerType: mechanic.providerType,
        vehicleModel: mechanic.vehicleModel,
        vehiclePlate: mechanic.vehiclePlate,
        phone: mechanicProfile?.phone,
        avatar: mechanicProfile?.avatar,
      });

      await fetchOnlineMechanics();
      toast.success(`✅ ${mechanic.name} selecionado. Agora clique no botão “Solicitar” abaixo.`);
      return true;
    } catch (error: any) {
      console.error('Erro ao verificar/definir status do mecânico:', error);
      toast.error(error?.message || 'Não foi possível selecionar este mecânico.');
      return false;
    }
  };

  const rememberNearestMechanic = (mechanic: (typeof onlineMechanics)[number]) => {
    const saved = { id: mechanic.id, name: mechanic.name };
    setLastShownNearestMechanic(saved);
    if (!user?.id) return;

    try {
      window.localStorage.setItem(
        `kuidacar:last-nearest-mechanic:${user.id}`,
        JSON.stringify(saved),
      );
    } catch (error) {
      console.error("Não foi possível guardar o último mecânico recomendado:", error);
      toast.error("O mecânico foi selecionado, mas não foi possível guardar esta recomendação neste dispositivo.");
    }
  };

  const handleNearestMechanicClick = async () => {
    if (!nearestMechanic) return;

    if (lastShownNearestMechanic?.id === nearestMechanic.mechanic.id) {
      setSameNearestMechanicDialogOpen(true);
      return;
    }

    if (await selectMechanic(nearestMechanic.mechanic)) {
      rememberNearestMechanic(nearestMechanic.mechanic);
    }
  };

  const selectNearestMechanicOption = async (mechanic: (typeof onlineMechanics)[number] | undefined) => {
    if (!mechanic) return;
    setSameNearestMechanicDialogOpen(false);
    if (await selectMechanic(mechanic) && nearestMechanic) {
      rememberNearestMechanic(nearestMechanic.mechanic);
    }
  };

  const viewMechanicProfile = async (mechanic: (typeof onlineMechanics)[number]) => {
    const profile = await fetchMechanicProfile(mechanic.id);
    setSelectedProviderProfile({
      id: mechanic.id,
      name: profile?.name || mechanic.name,
      email: profile?.email || "",
      phone: profile?.phone || "Não disponível",
      providerType: mechanic.providerType,
      vehicleModel: mechanic.vehicleModel,
      vehiclePlate: mechanic.vehiclePlate,
      avatar: profile?.avatar,
    });
    setProfileModalOpen(true);
  };

  useEffect(() => {
    if (!user || !lastCreatedRequestId) {
      setRequestDeleteBlocked(false);
      setRequestLifecycleNotice(null);
      return;
    }

    const requestId = lastCreatedRequestId;
    const channel = supabase
      .channel(`request-lifecycle-${requestId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `request_id=eq.${requestId}` },
        (payload) => {
          const nextMessage = (payload as any)?.new;
          if (!nextMessage || String(nextMessage.receiver_id || '') !== String(user.id)) return;

          const content = String(nextMessage.content || '').toLowerCase();
          const isFinalizedByMechanic = [
            'finalizou',
            'finalizou a solicitação',
            'concluiu',
            'finalizada',
            'termine a solicitação',
            'finalizou o serviço',
          ].some((keyword) => content.includes(keyword));

          if (isFinalizedByMechanic) {
            setRequestDeleteBlocked(true);
            setRequestLifecycleNotice('O mecânico finalizou a solicitação. Por favor termine a solicitação para fechar o processo.');
            toast.info('O mecânico finalizou a solicitação. O botão de eliminação foi bloqueado até concluir o processo.');
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_requests', filter: `id=eq.${requestId}` },
        (payload) => {
          if (String(payload.new.customer_id || '') !== String(user.id)) return;
          const nextStatus = String(payload.new.status || '').toLowerCase();
          setUserRequests((requests) => requests.map((request) =>
            String(request.id) === requestId
              ? { ...request, status: payload.new.status }
              : request,
          ));
          if (nextStatus === 'awaiting_customer_confirmation') {
            setRequestDeleteBlocked(true);
            setRequestLifecycleNotice('O mecânico informou que concluiu o serviço. Confirme a conclusão para encerrar o processo.');
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, lastCreatedRequestId]);

  const handleDeleteRequest = async (requestId: string) => {
    if (requestDeleteBlocked) {
      toast.error(requestLifecycleNotice || 'A solicitação foi finalizada pelo mecânico. Termine-a antes de eliminar.');
      return;
    }

    const request = userRequests.find((item) => String(item.id) === String(requestId));
    if (request && isAwaitingCustomerConfirmation(request.status)) {
      toast.error('O mecânico aguarda a confirmação da conclusão. Confirme o serviço ou fale com o suporte antes de eliminar.');
      return;
    }
    if (request && isMechanicAtCustomer(request)) {
      toast.error('Não é possível eliminar a solicitação: o mecânico já chegou ao local do cliente.');
      return;
    }
    const providerId = request?.providerId || request?.provider_id || request?.mechanicId || blockingTargetUserId || selectedMechanicId;
    const hasAssignedMechanic = Boolean(providerId);

    if (!hasAssignedMechanic) {
      try {
        await apiClient.deleteServiceRequest(requestId);
        setUserRequests((prev) => prev.filter((item) => String(item.id) !== String(requestId)));
        toast.success('Solicitação sem mecânico eliminada diretamente do sistema.');
        return;
      } catch (error: any) {
        console.error('Erro ao eliminar solicitação sem mecânico:', error);
        toast.error(error?.message || 'Erro ao eliminar solicitação.');
        return;
      }
    }

    // Open block modal flow (client cancel -> block on provider panel)
    // We'll resolve providerId when submitting the block
    setBlockingRequestId(requestId);
    setBlockingTargetUserId(String(providerId));
    setBlockModalOpen(true);
  };

  const openDeleteRequestConfirm = () => {
    const requestId = lastCreatedRequestId;
    if (!requestId) {
      toast.error('Nenhuma solicitação ativa para eliminar.');
      return;
    }

    if (requestDeleteBlocked) {
      toast.error(requestLifecycleNotice || 'A solicitação foi finalizada pelo mecânico. Termine-a antes de eliminar.');
      return;
    }

    const activeRequest = userRequests.find((request) => String(request.id) === String(requestId));
    if (activeRequest && isAwaitingCustomerConfirmation(activeRequest.status)) {
      toast.error('O mecânico aguarda a confirmação da conclusão. Confirme o serviço ou fale com o suporte antes de eliminar.');
      return;
    }
    if (isSelectedMechanicAtCustomer() || (activeRequest && isMechanicAtCustomer(activeRequest))) {
      toast.error('Não é possível eliminar a solicitação: o mecânico já chegou ao local do cliente.');
      return;
    }

    setBlockingRequestId(requestId);
    setBlockingTargetUserId(selectedMechanicId || null);
    setDeleteRequestConfirmOpen(true);
  };

  const openNewRequestConfirm = () => {
    const requestId = lastCreatedRequestId;
    if (!requestId) {
      setRouteMode(false);
      return;
    }

    const activeRequest = userRequests.find((request) => String(request.id) === String(requestId));
    if (isSelectedMechanicAtCustomer() || (activeRequest && isMechanicAtCustomer(activeRequest))) {
      toast.error('Não é possível eliminar a solicitação: o mecânico já chegou ao local do cliente.');
      return;
    }

    setBlockingRequestId(requestId);
    setBlockingTargetUserId(selectedMechanicId || null);
    setDeleteRequestConfirmOpen(true);
  };

  const confirmDeleteCurrentRequest = async () => {
    if (!blockingRequestId) {
      setDeleteRequestConfirmOpen(false);
      return;
    }

    const request = userRequests.find((item) => String(item.id) === String(blockingRequestId));
    if (request && isAwaitingCustomerConfirmation(request.status)) {
      setDeleteRequestConfirmOpen(false);
      toast.error('O mecânico aguarda a confirmação da conclusão. Confirme o serviço ou fale com o suporte antes de eliminar.');
      return;
    }
    if (isSelectedMechanicAtCustomer() || (request && isMechanicAtCustomer(request))) {
      setDeleteRequestConfirmOpen(false);
      toast.error('Não é possível eliminar a solicitação: o mecânico já chegou ao local do cliente.');
      return;
    }
    const providerId = request?.providerId || request?.provider_id || request?.mechanicId || blockingTargetUserId || selectedMechanicId;
    const hasAssignedMechanic = Boolean(providerId);

    if (hasAssignedMechanic) {
      setBlockingTargetUserId(String(providerId));
      setDeleteRequestConfirmOpen(false);
      setBlockModalOpen(true);
      return;
    }

    try {
      await apiClient.deleteServiceRequest(blockingRequestId);

      setUserRequests((prev) => prev.filter((request) => String(request.id) !== String(blockingRequestId)));
      setRouteMode(false);
      setViewExistingRequests(false);
      setLastCreatedRequestId(null);
      setSelectedMechanicId(null);
      setSelectedMechanicName(null);
      setSelectedMechanicPosition(null);
      setSelectedProviderProfile(null);
      setDeleteRequestConfirmOpen(false);

      toast.success('Solicitação sem mecânico eliminada diretamente do sistema.');
    } catch (error: any) {
      console.error('Erro ao eliminar solicitação do banco:', error);
      toast.error(error?.message || 'Erro ao eliminar solicitação.');
      setDeleteRequestConfirmOpen(false);
    }
  };

  const openBlockModal = (requestId: string, targetUserId: string | null) => {
    setBlockingRequestId(requestId);
    setBlockingTargetUserId(targetUserId);
    setBlockModalOpen(true);
  };

  const submitBlock = async (reason: string) => {
    if (!blockingRequestId) return;

    try {
      let providerNotified = !blockingTargetUserId;
      // Try to resolve providerId if not provided
      let providerId = blockingTargetUserId;
      if (!providerId) {
        try {
          const getResp: any = await apiClient.getServiceRequest(blockingRequestId);
          if (getResp.success && getResp.request) {
            providerId = getResp.request.providerId || null;
          }
        } catch (e) {
          // ignore
        }
      }

      const payload: any = {
        isBlocked: true,
        blockedBy: user?.id || 'unknown',
        blockedReason: reason,
        blockedAt: new Date().toISOString(),
        status: 'blocked',
      };

      await apiClient.updateServiceRequest(blockingRequestId, payload);
      setUserRequests((prev) => prev.filter((r) => String(r.id) !== String(blockingRequestId)));

      let providerAvailable = true;
      if (providerId) {
        try {
          await makeMechanicAvailable(providerId);
        } catch (statusError: any) {
          providerAvailable = false;
          console.error('Solicitação eliminada, mas não foi possível disponibilizar o mecânico:', statusError);
          toast.error(statusError?.message || 'Não foi possível disponibilizar o mecânico.');
        }
      }

      if (providerId) {
        const message = `O cliente eliminou a solicitação. Motivo: ${reason}`;
        const results = await Promise.allSettled([
          apiClient.sendMessage(
            blockingRequestId,
            providerId,
            message,
          ),
          apiClient.createNotification({
            userId: providerId,
            requestId: blockingRequestId,
            type: 'request_blocked',
            title: 'Solicitação eliminada pelo cliente',
            message,
            payload: { reason, requestId: blockingRequestId, deleted: true },
          }),
        ]);
        providerNotified = results.some((result) => result.status === 'fulfilled');
        if (!providerNotified) {
          console.error('Falharam as duas formas de notificação do cancelamento:', results);
        } else if (results.some((result) => result.status === 'rejected')) {
          console.warn('Uma das formas de notificação do cancelamento falhou:', results);
        }
      }

      if (lastCreatedRequestId === blockingRequestId) {
        setLastCreatedRequestId(null);
        setSelectedMechanicId(null);
        setSelectedMechanicName(null);
        setSelectedMechanicPosition(null);
        setSelectedProviderProfile(null);
        setRouteMode(false);
        setViewExistingRequests(false);
      }

      if (providerAvailable) {
        toast.success(providerNotified
          ? 'Solicitação cancelada e motivo enviado ao mecânico. O mecânico está disponível novamente.'
          : 'Solicitação cancelada. O mecânico está disponível novamente, mas não foi possível notificá-lo.');
      } else {
        toast.success(providerNotified
          ? 'Solicitação cancelada e mecânico avisado, mas não foi possível atualizar a disponibilidade.'
          : 'Solicitação cancelada, mas não foi possível atualizar a disponibilidade nem notificar o mecânico.');
      }
    } catch (err: any) {
      console.error('Erro ao bloquear/eliminar solicitação:', err);
      toast.error(err?.message || 'Erro ao bloquear/eliminar solicitação');
    } finally {
      setBlockModalOpen(false);
      setBlockingRequestId(null);
      setBlockingTargetUserId(null);
    }
  };

  // detect blocked requests for this user (client) and show modal
  useEffect(() => {
    const blocked = userRequests.find(r => (r as any).is_blocked && (r as any).customerId === user?.id);
    if (blocked) {
      setBlockedRequestId(blocked.id);
      setBlockedReasonText((blocked as any).blockedReason || null);
      setBlockedReasonOpen(true);
    }
  }, [userRequests, user?.id]);

  const handleChatClose = () => {
    setChatModalOpenForExisting(false);
    setSelectedRequestForChat(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-orange-600 text-white p-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-white hover:bg-orange-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Solicitar Assistência</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onNotificationClick={handleNotificationClick}
              onDeleteNotification={handleDeleteNotification}
              onDeleteAllNotifications={handleDeleteAllNotifications}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHelpModalOpen(true)}
              title="Centro de Ajuda"
              className="text-white hover:bg-orange-700"
            >
              <HelpCircle className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/profile")}
              className="text-white hover:bg-orange-700"
            >
              <User className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-orange-700"
              onClick={() => {
                if (!window.confirm('Deseja mesmo sair da conta? Isso terminará a sua sessão atual.')) return;
                logout();
                toast.success("Sessão encerrada com sucesso.");
                navigate("/", { replace: true });
              }}
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 pb-3 pt-2">
        {/* Push Notifications Setup moved above the warning bar */}
        {isSupported && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mx-6 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 text-sm">🔔 Notificações Push</h3>
                <p className="text-blue-700 text-xs mt-1">
                  Receba alertas instantâneos mesmo com o app fechado
                </p>
              </div>
              <div className="flex gap-2">
                {permission === 'granted' && subscription ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestNotification}
                      className="text-xs"
                    >
                      Testar
                    </Button>
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                      Ativo
                    </Badge>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEnablePushNotifications}
                    className="text-xs"
                    disabled={permission === 'denied'}
                  >
                    {permission === 'denied' ? 'Bloqueado' : 'Permitir'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notification bar removed as requested */}

        {adminMessages.length > 0 && (
          <Button
            variant="outline"
            className="relative w-full justify-center gap-2 border-orange-200 bg-white text-orange-700 hover:bg-orange-50"
            onClick={handleOpenAdminMessages}
          >
            <MessageCircle className="w-4 h-4" />
            {adminMessagesOpen ? "Ocultar mensagens do admin" : "Mensagens do admin"}
            {adminUnreadCount > 0 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <Badge className="rounded-full bg-red-500 text-white text-[11px] px-2 py-0.5">{adminUnreadCount}</Badge>
              </span>
            )}
          </Button>
        )}
      </div>

      {showDeleteAllAdminMessagesConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-orange-200 bg-white p-5 shadow-xl">
            <p className="text-lg font-semibold text-gray-900">Eliminar todas as mensagens?</p>
            <p className="mt-2 text-sm text-gray-600">Esta ação remove todas as mensagens recebidas do administrador.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteAllAdminMessagesConfirm(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDeleteAllCustomerMessages}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}

      <div className={adminMessagesOpen ? "max-w-md mx-auto px-6 pb-4" : "hidden max-w-md mx-auto px-6 pb-4"}>
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Mensagens do administrador</h2>
          </div>

          {loadingAdminMessages ? (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
              <MessageCircle className="w-4 h-4 animate-pulse" />
              Carregando mensagens...
            </div>
          ) : adminMessages.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma mensagem do administrador ainda.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setShowDeleteAllAdminMessagesConfirm(true)}>
                  Eliminar todas mensagens
                </Button>
              </div>
              {adminMessages.map((message, index) => {
                const safeKey = message?.id || `request-admin-message-${message?.created_at || 'unknown'}-${index}`;
                return (
                  <div
                    key={safeKey}
                    className="rounded-xl border border-orange-100 bg-orange-50 p-3 relative cursor-pointer"
                    onClick={async () => {
                      // Abrir chat para o request_id (suporta valores como "support:<ticketId>")
                      const reqId = message?.request_id || `support:${message?.support_ticket_id || message?.id}`;
                      if (!reqId) return;

                      // Preparar dados do remetente (admin)
                      const senderId = message?.sender_id || null;
                      const senderName = message?.sender_name || 'Administrador';

                      setSelectedRequestForChat({ id: reqId, providerId: senderId });
                      setSelectedProviderProfile({ id: senderId, name: senderName, avatar: message?.sender_avatar });
                      setChatModalOpenForExisting(true);

                      // Marcar mensagens como lidas para esse request_id
                      try {
                        await apiClient.markMessagesAsRead(reqId as string);
                      } catch (err) {
                        console.warn('Erro ao marcar mensagens como lidas:', err);
                      }
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!message?.id) return;
                        setConfirmDeleteMessageId(message.id);
                      }}
                      className="absolute right-3 top-3 rounded-full border border-red-200 bg-white p-1 text-red-600 hover:bg-red-50"
                      aria-label="Excluir mensagem"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-orange-700">
                      {new Date(message.created_at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-black">{message.content}</p>
                    {confirmDeleteMessageId === message.id && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="mb-3 text-sm font-medium text-red-700">Deseja eliminar esta mensagem?</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteCustomerMessage(message.id)}>
                            Confirmar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setConfirmDeleteMessageId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const reqId = message?.request_id || `support:${message?.support_ticket_id || message?.ticket_id || message?.id}`;
                          if (!reqId) return;
                          const ticketId = String(reqId).replace(/^support:/, "");
                          setSupportTicketIdToShow(ticketId);
                          setSupportTicketModalOpen(true);
                        }}
                        className="text-sm text-orange-600 underline"
                      >
                        Ver ticket
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </Card>
      </div>

      {/* Link to help center below messages */}
      <div className="max-w-md mx-auto px-6 pb-6">
        <div className="text-center text-sm">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setHelpModalOpen(true);
            }}
            className="text-orange-600 underline"
          >
            Se tiver alguma dúvida ou pergunta, acesse o Centro de Ajuda
          </button>
        </div>
      </div>

      {/* Duplicate Push Notifications section removed */}

      {/* Content */}
      <div className="max-w-md mx-auto p-6">
        {routeMode ? (
          viewExistingRequests ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Suas Solicitações</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={stopTrackedRoute}
                  className="h-8 w-8 text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {userRequests.map((request) => (
                <Card key={request.id} className="p-4">
                  <div className="mb-3">
                    <Badge className="bg-orange-600 text-white mb-2">
                      {serviceTypeLabels[request.type] || request.type}
                    </Badge>
                    <p className="text-sm text-gray-600">{request.description || "Sem descrição"}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(request.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="h-64 rounded-lg overflow-hidden mb-3">
                    <RealTimeMap
                      center={[request.location.lat, request.location.lng] as [number, number]}
                      zoom={15}
                      markers={[
                        ...(currentLocation ? [{
                          position: [currentLocation.lat, currentLocation.lng] as [number, number],
                          title: "Você",
                          icon: "user",
                          color: "blue",
                          label: "Você",
                        }] : []),
                        {
                          position: [request.location.lat, request.location.lng] as [number, number],
                          title: "Local da solicitação",
                          icon: "workshop",
                          color: "orange",
                          label: "Solicitação",
                        },
                      ]}
                      routePath={viewRequestRoutes?.[request.id] as Array<[number, number]>}
                    />
                  </div>
                  {currentLocation && (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm text-gray-700 mb-3">
                        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                          <p className="text-xs uppercase font-semibold text-gray-500">Distância</p>
                          <p className="mt-1 text-lg font-semibold text-gray-900">
                            {getRouteSummary(currentLocation, [request.location.lat, request.location.lng]).distance}
                          </p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                          <p className="text-xs uppercase font-semibold text-gray-500">Duração</p>
                          <p className="mt-1 text-lg font-semibold text-gray-900">
                            {getRouteSummary(currentLocation, [request.location.lat, request.location.lng]).duration}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm mb-3">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-3 w-3 rounded-full bg-blue-600" />
                            <span className="text-sm font-medium text-gray-900">Você</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-3 w-3 rounded-full bg-orange-600" />
                            <span className="text-sm font-medium text-gray-900">Local da Solicitação</span>
                          </div>
                          {request.providerId && request.mechanicName && (
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-3 w-3 rounded-full bg-green-600" />
                              <span className="text-sm font-medium text-gray-900">Mecânico: {request.mechanicName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedRequestForChat(request);
                        setSelectedProviderProfile({
                          id: request.providerId,
                          name: request.mechanicName || "Mecânico",
                        });
                        setChatModalOpenForExisting(true);
                        clearUnreadForRequest(request.id);
                      }}
                      disabled={!request.providerId}
                      className="relative flex-1"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Chat
                      {unreadRequestIds.has(request.id) && (
                        <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-white" />
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCallMechanic(request)}
                      disabled={!request.providerId}
                      className="flex-1"
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Ligar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 flex-1"
                      onClick={() => handleDeleteRequest(request.id)}
                      disabled={isMechanicAtCustomer(request) || isAwaitingCustomerConfirmation(request.status)}
                      title={isMechanicAtCustomer(request)
                        ? 'O mecânico já chegou ao local do cliente'
                        : isAwaitingCustomerConfirmation(request.status)
                          ? 'O mecânico aguarda confirmação da conclusão'
                          : undefined}
                    >
                      {isMechanicAtCustomer(request)
                        ? 'Mecânico chegou'
                        : isAwaitingCustomerConfirmation(request.status)
                          ? 'Aguardando confirmação'
                          : 'Eliminar Solicitação'}
                    </Button>
                    {/* Cliente pode encerrar/confirmar atendimento */}
                    {String(user?.id) === String(request.customerId) && isAwaitingCustomerConfirmation(request.status) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          // open rate modal for this request
                          setRateModalOpen(true);
                          setReviewModalData(null);
                          // store the request id and mechanic for modal via local states
                          setRateModalRequestId(request.id);
                          setRateModalMechanicId(request.providerId || null);
                          setRateModalMechanicName(request.mechanicName || request.mechanic_name || null);
                        }}
                        className="flex-1"
                      >
                        Confirmar conclusão e avaliar
                      </Button>
                    )}
                  </div>
                  {/* Review area for finalized services */}
                  {['completed', 'finalized', 'finalizado'].includes(String(request.status || '').toLowerCase()) && (
                    <div className="mt-3">
                      {openReviewRequestId === request.id ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium">Avaliar mecânico</span>
                              <StarRating value={reviewRating} onChange={(v) => setReviewRating(v)} />
                            </div>
                            <div className="text-sm text-gray-500">{reviewRating} / 5</div>
                          </div>
                          <Textarea value={reviewComment} onChange={(e: any) => setReviewComment(e.target.value)} placeholder="Deixe um comentário (opcional)" />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={async () => {
                              if (!user) { toast.error('Faça login para enviar avaliação'); return; }
                              if (!request.providerId) { toast.error('Mecânico ausente'); return; }
                              setReviewLoading(true);
                              try {
                                await apiClient.createMechanicReview({ mechanicId: request.providerId, rating: reviewRating, comment: reviewComment || null, serviceId: request.id });
                                toast.success('Avaliação enviada com sucesso');
                                setOpenReviewRequestId(null);
                                setReviewComment('');
                                // refresh requests to reflect review state
                                fetchUserRequests().catch(() => {});
                              } catch (err: any) {
                                console.error('Erro ao enviar avaliação:', err);
                                toast.error(err?.message || 'Erro ao enviar avaliação');
                              } finally {
                                setReviewLoading(false);
                              }
                            }} disabled={reviewLoading}>
                              Enviar avaliação
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setOpenReviewRequestId(null); setReviewComment(''); }}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <Button size="sm" onClick={() => { setOpenReviewRequestId(request.id); setReviewRating(5); setReviewComment(''); }}>
                            Avaliar mecânico
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label className="text-base">Rota para o mecânico selecionado</Label>
                  {selectedService && (
                    <p className="mt-1 text-sm font-semibold text-orange-700">
                      Preço do serviço: {new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 0 }).format(getEstimatedPrice(selectedService))} Kz
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={stopTrackedRoute}
                  className="h-8 w-8 text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="h-96 rounded-lg overflow-hidden">
                <RealTimeMap
                  center={currentLocation ? [currentLocation.lat, currentLocation.lng] : [-8.8383, 13.2344]}
                  zoom={14}
                  markers={[
                    {
                      position: currentLocation ? [currentLocation.lat, currentLocation.lng] : [-8.8383, 13.2344],
                      title: "Você",
                      icon: "user",
                      color: "blue",
                      label: "Você",
                    },
                    ...(selectedMechanicPosition ? [{
                      position: selectedMechanicPosition,
                      title: selectedMechanicName ? `${selectedMechanicName}` : "Mecânico selecionado",
                      icon: "mechanic",
                      color: "green",
                      label: selectedMechanicName || "Mecânico",
                    }] : []),
                  ]}
                  routePath={stableRoutePath}
                />
              </div>
              {(selectedMechanicPosition && currentLocation) && (
                <div className="mt-2 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                      <p className="text-xs uppercase font-semibold text-gray-500">Distância</p>
                      <p className="mt-1 text-lg font-semibold text-gray-900">
                        {mechanicRoadDistanceKm !== null
                          ? `${mechanicRoadDistanceKm.toFixed(1)} km`
                          : isMechanicRoadRouteUnavailable
                            ? 'Indisponível'
                            : 'Calculando...'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                      <p className="text-xs uppercase font-semibold text-gray-500">Duração</p>
                      <p className="mt-1 text-lg font-semibold text-gray-900">
                        {getMechanicTravelDuration()}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-3 w-3 rounded-full bg-green-600" />
                        <span className="text-sm font-medium text-gray-900">Mecânico: {selectedMechanicName || "Mecânico"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-3 w-3 rounded-full bg-blue-600" />
                        <span className="text-sm font-medium text-gray-900">Você</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-4 space-y-3">
                  {selectedMechanicName ? (
                    <p className="text-sm text-gray-600">Rota traçada entre você e {selectedMechanicName}.</p>
                  ) : (
                    <p className="text-sm text-gray-600">Solicitação enviada. Selecione um mecânico antes para traçar a rota exata.</p>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-2 flex-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 relative"
                        onClick={async () => {
                          if (!selectedMechanicId || !lastCreatedRequestId) {
                            toast.error("Selecione um mecânico para abrir o chat.");
                            return;
                          }

                          if (!selectedProviderProfile || selectedProviderProfile.id !== selectedMechanicId) {
                            const mechanicProfile = await fetchMechanicProfile(selectedMechanicId);
                            setSelectedProviderProfile({
                              id: selectedMechanicId,
                              name: selectedMechanicName || "Mecânico",
                              providerType: selectedProviderProfile?.providerType,
                              vehicleModel: selectedProviderProfile?.vehicleModel,
                              vehiclePlate: selectedProviderProfile?.vehiclePlate,
                              phone: mechanicProfile?.phone,
                              avatar: mechanicProfile?.avatar,
                            });
                          }

                          setSelectedRequestForChat({ id: lastCreatedRequestId, providerId: selectedMechanicId });
                          setChatModalOpen(true);
                          clearUnreadForRequest(lastCreatedRequestId);
                        }}
                        disabled={!selectedMechanicId || !lastCreatedRequestId}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Chat
                        {lastCreatedRequestId && unreadRequestIds.has(lastCreatedRequestId) && (
                          <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-white" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={async () => {
                          const mechanicId = selectedProviderProfile?.id || selectedMechanicId;
                          if (!mechanicId) {
                            toast.error("Selecione um mecânico para fazer a chamada.");
                            return;
                          }

                          toast.loading('Buscando contacto do mecânico...');
                          const phone = await fetchMechanicPhoneFromKvStore(mechanicId);

                          if (phone) {
                            toast.dismiss();
                            toast.success('📞 Ligando para o mecânico...');
                            window.location.href = `tel:${phone}`;
                          } else {
                            toast.dismiss();
                            toast.error('❌ Telefone do mecânico não encontrado no KV store.');
                          }
                        }}
                        disabled={!selectedMechanicId}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Ligar
                      </Button>

                    </div>
                      <Button
                        type="button"
                        className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700"
                        onClick={openNewRequestConfirm}
                      >
                        Nova solicitação
                      </Button>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 flex-1 bg-orange-600 px-2 text-xs hover:bg-orange-700 sm:text-sm"
                        disabled={!isAwaitingCustomerConfirmation(lastCreatedRequest?.status)}
                        onClick={async () => {
                          if (!lastCreatedRequestId || !selectedMechanicId) {
                            toast.error('Nenhuma solicitação ou mecânico selecionado para encerrar.');
                            return;
                          }
                          if (!isAwaitingCustomerConfirmation(lastCreatedRequest?.status)) {
                            toast.info('Aguarde o mecânico informar que concluiu o serviço. Só então poderá confirmar e encerrar a solicitação.');
                            return;
                          }

                          setRateModalRequestId(lastCreatedRequestId);
                          setRateModalMechanicId(selectedMechanicId);
                          setRateModalMechanicName(selectedMechanicName || undefined);
                          setRateModalOpen(true);
                        }}
                      >
                        {isAwaitingCustomerConfirmation(lastCreatedRequest?.status)
                          ? 'Confirmar conclusão'
                          : 'Aguardar conclusão do mecânico'}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-9 flex-1 bg-red-600 px-2 text-xs hover:bg-red-700 sm:text-sm"
                        onClick={openDeleteRequestConfirm}
                        disabled={isSelectedMechanicAtCustomer()}
                        title={isSelectedMechanicAtCustomer() ? 'O mecânico já chegou ao local do cliente' : undefined}
                      >
                        {isSelectedMechanicAtCustomer() ? 'Mecânico chegou' : 'Eliminar'}
                      </Button>
                    </div>
                </div>
            </Card>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
          {/* Service Type Selection */}
          <Card className="p-4">
            <Label className="text-base mb-3 block">Tipo de Serviço</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {pagedServiceTypes.map((service) => {
                const Icon = service.icon;
                const shouldRenderImage = isImageIcon(serviceCatalog.find((item) => item.id === service.id)?.icon || '');
                const serviceIcon = serviceCatalog.find((item) => item.id === service.id)?.icon;

                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setSelectedService(service.id)}
                    className={`min-w-0 rounded-lg border-2 p-2.5 text-center transition-all sm:p-3 ${
                      selectedService === service.id
                        ? "border-orange-600 bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div
                      className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full sm:h-12 sm:w-12 ${service.color}`}
                    >
                      {shouldRenderImage && serviceIcon ? (
                        <img src={serviceIcon} alt={service.name} className="h-full w-full object-cover" />
                      ) : (
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                      )}
                    </div>
                    <p className="min-w-0 break-words text-[10px] font-medium leading-tight text-gray-800 sm:text-xs">
                      {service.name}
                    </p>
                  </button>
                );
              })}
            </div>

            {serviceTypes.length > SERVICES_PER_PAGE && (
              <div className="mt-4 flex items-center justify-between gap-2 text-xs text-gray-500">
                <span>Página {currentServicePage} de {totalServicePages}</span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setServicePage((prev) => Math.max(1, prev - 1))}
                    disabled={currentServicePage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setServicePage((prev) => Math.min(totalServicePages, prev + 1))}
                    disabled={currentServicePage === totalServicePages}
                  >
                    Seguinte
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Button to open existing requests */}
          {userRequests.length > 0 && (
            <Card className="p-4">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  // Open the route panel for the currently selected mechanic
                  if (selectedMechanicId && selectedMechanicPosition) {
                    setViewExistingRequests(false);
                    setRouteMode(true);

                    if (currentLocation && selectedMechanicPosition) {
                      setStableRoutePath([
                        [currentLocation.lat, currentLocation.lng],
                        selectedMechanicPosition,
                      ]);
                    }
                    return;
                  }

                  // Fallback: usar último pedido criado para identificar o mecânico
                  let handled = false;
                  if (lastCreatedRequestId) {
                    try {
                      const resp: any = await apiClient.getServiceRequest(lastCreatedRequestId);
                      if (resp.success && resp.request && resp.request.providerId) {
                        // garantir que temos o id do último pedido para habilitar chat
                        if (resp.request.id) setLastCreatedRequestId(resp.request.id);
                        const providerId = resp.request.providerId;
                        setSelectedMechanicId(providerId);
                        setSelectedMechanicName(resp.request.mechanicName || resp.request.providerId);

                        // preencher profile localmente (antes de obter localização)
                        const mechanicProfile = await fetchMechanicProfile(providerId);
                        setSelectedProviderProfile({
                          id: providerId,
                          name: resp.request.mechanicName || mechanicProfile?.name || 'Mecânico',
                          providerType: mechanicProfile?.providerType,
                          vehicleModel: mechanicProfile?.vehicleModel,
                          vehiclePlate: mechanicProfile?.vehiclePlate,
                          phone: mechanicProfile?.phone,
                          avatar: mechanicProfile?.avatar,
                        });

                        // Primeiro, usar providerLocation salvo na própria solicitação se existir
                        const reqLoc = resp.request.providerLocation || resp.request.provider_location || null;
                        if (reqLoc && reqLoc.lat && reqLoc.lng) {
                          setSelectedMechanicPosition([reqLoc.lat, reqLoc.lng]);
                          if (!currentLocation) {
                            try { await getCurrentLocation(); } catch (err) { console.warn('Erro ao obter localização:', err); }
                          }
                          setViewExistingRequests(false);
                          setRouteMode(true);
                          if (currentLocation) {
                            setStableRoutePath([
                              [currentLocation.lat, currentLocation.lng],
                              [reqLoc.lat, reqLoc.lng],
                            ]);
                          }
                          toast.success('Rota aberta para o mecânico do seu último pedido');
                          return;
                        }

                        // Se não houver providerLocation na request, tentar obter do KV store
                        const locResp: any = await apiClient.getProviderLocationById(providerId);
                        if (locResp.success && locResp.location) {
                          setSelectedMechanicPosition([locResp.location.lat, locResp.location.lng]);
                          if (!currentLocation) {
                            try { await getCurrentLocation(); } catch (err) { console.warn('Erro ao obter localização:', err); }
                          }
                          setViewExistingRequests(false);
                          setRouteMode(true);
                          if (currentLocation) {
                            setStableRoutePath([
                              [currentLocation.lat, currentLocation.lng],
                              [locResp.location.lat, locResp.location.lng],
                            ]);
                          }

                          toast.success('Rota aberta para o mecânico do seu último pedido');
                          return;
                        } else {
                          // couldn't get location from KV for this request
                          toast.error('Não foi possível obter localização do mecânico do pedido.');
                          handled = true;
                        }
                      } else {
                        // last created request has no provider assigned
                        handled = true;
                      }
                    } catch (err) {
                      console.error('Erro ao abrir rota a partir do último pedido:', err);
                      toast.error('Erro ao recuperar informações do último pedido.');
                      handled = true;
                    }
                  }

                  // If not handled yet, try to find the most recent user request that has a providerId
                  if (!handled && (!lastCreatedRequestId || handled)) {
                    const recentWithProvider = userRequests.find((r) => r.providerId);
                    if (recentWithProvider && recentWithProvider.id) {
                      try {
                        // marcar este pedido como "último" para que as ações de chat usem seu id
                        setLastCreatedRequestId(recentWithProvider.id);
                        const providerId = recentWithProvider.providerId;
                        setSelectedMechanicId(providerId);
                        setSelectedMechanicName(recentWithProvider.mechanicName || providerId);

                        const mechanicProfile = await fetchMechanicProfile(providerId);
                        setSelectedProviderProfile({
                          id: providerId,
                          name: recentWithProvider.mechanicName || mechanicProfile?.name || 'Mecânico',
                          providerType: mechanicProfile?.providerType,
                          vehicleModel: mechanicProfile?.vehicleModel,
                          vehiclePlate: mechanicProfile?.vehiclePlate,
                          phone: mechanicProfile?.phone,
                          avatar: mechanicProfile?.avatar,
                        });

                        const reqLoc = recentWithProvider.providerLocation || recentWithProvider.provider_location || recentWithProvider.location || null;
                        if (reqLoc && reqLoc.lat && reqLoc.lng) {
                          setSelectedMechanicPosition([reqLoc.lat, reqLoc.lng]);
                          if (!currentLocation) {
                            try { await getCurrentLocation(); } catch (err) { console.warn('Erro ao obter localização:', err); }
                          }
                          setViewExistingRequests(false);
                          setRouteMode(true);
                          if (currentLocation) {
                            setStableRoutePath([
                              [currentLocation.lat, currentLocation.lng],
                              [reqLoc.lat, reqLoc.lng],
                            ]);
                          }
                          toast.success('Rota aberta para o mecânico do seu último pedido');
                          handled = true;
                        } else {
                          // Try KV fallback
                          const locResp: any = await apiClient.getProviderLocationById(providerId);
                          if (locResp.success && locResp.location) {
                            setSelectedMechanicPosition([locResp.location.lat, locResp.location.lng]);
                            if (!currentLocation) {
                              try { await getCurrentLocation(); } catch (err) { console.warn('Erro ao obter localização:', err); }
                            }
                            setViewExistingRequests(false);
                            setRouteMode(true);
                            if (currentLocation) {
                              setStableRoutePath([
                                [currentLocation.lat, currentLocation.lng],
                                [locResp.location.lat, locResp.location.lng],
                              ]);
                            }
                            toast.success('Rota aberta para o mecânico do seu último pedido');
                            handled = true;
                          }
                        }
                      } catch (err) {
                        console.error('Erro ao abrir rota a partir de pedido recente:', err);
                        handled = true;
                      }
                    }
                  }

                  if (!handled) {
                    toast.error('Selecione primeiro um mecânico para ver a rota.');
                  }
                }}
                className="w-full"
              >
                Abrir solicitação feita agora
              </Button>
            </Card>
          )}

          {/* Location */}
          <Card className="p-4">
            <Label htmlFor="location" className="text-base mb-3 block">
              Localização
            </Label>
            <div className="space-y-3">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Digite o endereço ou use GPS"
                  className="pl-10"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
                className="w-full"
              >
                {isGettingLocation ? (
                  <>
                    <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mr-2" />
                    Obtendo localização...
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 mr-2" />
                    Usar Minha Localização Atual
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Permita o acesso à localização para obter seu endereço automaticamente
              </p>
            </div>
          </Card>

          {/* Map with user and mechanics markers */}
          {showLocationMap && currentLocation && (
            <div ref={locationMapRef}>
            <Card className="p-4">
              <Label className="text-base mb-3 block">
                Mecânicos conectados nas proximidades
              </Label>
              <div className="space-y-1 text-xs text-gray-500 mb-4">
                <p>Escolha um mecânico disponível pelos botões ou pelo mapa.</p>
                <p>A recomendação do mecânico disponível mais próximo aparece abaixo do mapa.</p>
              </div>

              {/* Botões dos prestadores online acima do mapa */}
              {onlineMechanics.length > 0 && (
                <div className="mb-4">
                  <div className="mb-3">
                    <Input
                      value={mechanicSearch}
                      onChange={(e) => setMechanicSearch(e.target.value)}
                      placeholder="Pesquisar mecânico por nome"
                      className="h-9"
                    />
                  </div>

                  {filteredMechanics.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {pagedMechanics.map((mechanic) => (
                          <button
                            key={mechanic.id}
                            type="button"
                            onClick={() => selectMechanic(mechanic)}
                            disabled={mechanic.status === 'occupied' && selectedMechanicId !== mechanic.id}
                            className={`px-3 py-2 rounded-full text-sm font-medium transition-all ${
                              selectedMechanicId === mechanic.id
                                ? 'bg-orange-100 text-orange-800 ring-2 ring-orange-400'
                                : mechanic.status === 'occupied'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${selectedMechanicId === mechanic.id ? 'bg-orange-500' : mechanic.status === 'occupied' ? 'bg-yellow-400' : 'bg-green-500'}`}></div>
                              <span>
                                {mechanic.name} - {selectedMechanicId === mechanic.id
                                  ? 'Selecionado'
                                  : mechanic.status === 'occupied'
                                    ? 'Ocupado'
                                    : 'Disponível'}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>

                      {filteredMechanics.length > 6 && (
                        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                          <span>Página {currentMechanicPage} de {totalMechanicPages}</span>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setMechanicPage((prev) => Math.max(1, prev - 1))}
                              disabled={currentMechanicPage === 1}
                            >
                              Anterior
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setMechanicPage((prev) => Math.min(totalMechanicPages, prev + 1))}
                              disabled={currentMechanicPage === totalMechanicPages}
                            >
                              Seguinte
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Nenhum mecânico encontrado para esta pesquisa.</p>
                  )}

                  <p className="text-xs text-gray-500 mt-2">
                    Clique em um prestador para selecioná-lo e ver sua localização no mapa
                  </p>
                </div>
              )}

              <div className="h-64 rounded-lg overflow-hidden">
                <RealTimeMap
                  key={`online-map-${currentLocation.lat}-${currentLocation.lng}-${onlineMechanics.length}`}
                  center={[currentLocation.lat, currentLocation.lng]}
                  zoom={15}
                  markers={[
                    // User marker
                    {
                      position: [currentLocation.lat, currentLocation.lng],
                      title: "Sua localização",
                      icon: "user",
                      color: "blue",
                      label: "você"
                    },
                    // Mechanics markers
                    ...onlineMechanics.map(mechanic => ({
                      position: mechanic.position,
                      title: `${mechanic.name} - ${mechanic.providerType}`,
                      icon: "mechanic",
                      color: mechanic.status === 'occupied' ? 'yellow' : (selectedMechanicId === mechanic.id ? "orange" : "green"),
                      label: mechanic.name,
                      isSelected: selectedMechanicId === mechanic.id,
                      onView: () => { void viewMechanicProfile(mechanic); },
                      onSelect: () => { void selectMechanic(mechanic); },
                      popup: `
                        <div class="p-2">
                          <h3 class="font-semibold">${mechanic.name}</h3>
                          <p class="text-sm text-gray-600">${mechanic.providerType}</p>
                          <p class="text-sm">${mechanic.vehicleModel} - ${mechanic.vehiclePlate}</p>
                        </div>
                      `
                    }))
                  ]}
                  routePath={displayedMechanicPosition ? [
                    [currentLocation.lat, currentLocation.lng],
                    displayedMechanicPosition,
                  ] : undefined}
                  onRouteCalculated={(distance, duration, _distanceKm, isFallback) => {
                    if (displayedMechanicId !== nearestMechanic?.mechanic.id) return;
                    setNearestRoadDistance(distance);
                    setNearestRoadDuration(duration);
                    setNearestRouteIsEstimated(Boolean(isFallback));
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {onlineMechanics.length} mecânico(s) online encontrado(s) na sua região
              </p>
              <div className="mt-4 flex flex-col gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                {nearestMechanic ? (
                  <>
                    <div className="text-sm font-medium text-gray-800">
                      <p>
                        Mecânico mais próximo: <span className="text-orange-700">{nearestMechanic.mechanic.name}</span>
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        Distância: {displayedMechanicId === nearestMechanic.mechanic.id && nearestRoadDistance
                          ? `${nearestRouteIsEstimated ? 'aprox. ' : ''}${nearestRoadDistance}`
                          : `aprox. ${nearestMechanic.distance.toFixed(1)} km`}
                        {' · '}
                        Duração: {displayedMechanicId === nearestMechanic.mechanic.id && nearestRoadDuration
                          ? `${nearestRouteIsEstimated ? 'aprox. ' : ''}${nearestRoadDuration}`
                          : `aprox. ${Math.max(1, Math.round((nearestMechanic.distance / 40) * 60))} min`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => { void handleNearestMechanicClick(); }}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {selectedMechanicId === nearestMechanic.mechanic.id
                        ? 'Mecânico escolhido · ver opções'
                        : 'Escolher este mecânico'}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">
                    Não há mecânicos disponíveis com localização nesta região.
                  </p>
                )}
              </div>
            </Card>
            </div>
          )}

          {/* Description */}
          <Card className="p-4">
            <Label htmlFor="description" className="text-base mb-3 block">
              Descrição do Problema (Opcional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que aconteceu com seu veículo..."
              rows={4}
            />
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={searching || hasActiveServiceRequest || !selectedService}
            className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-base disabled:cursor-not-allowed disabled:opacity-70"
            onClick={() => {
              if (hasActiveServiceRequest) {
                toast.error(activeRequestMessage);
              }
              if (!selectedService) {
                toast.error("Você deve selecionar um serviço antes de solicitar.");
              }
            }}
          >
            {searching ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Procurando prestador próximo...
              </span>
            ) : hasActiveServiceRequest ? (
              "Solicitação em curso"
            ) : (
              "Solicitar Assistência"
            )}
          </Button>
        </form>
        )}

        {/* Modals */}
        <Dialog
          open={sameNearestMechanicDialogOpen}
          onOpenChange={setSameNearestMechanicDialogOpen}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Este mecânico já foi recomendado</DialogTitle>
              <DialogDescription>
                {nearestMechanic?.mechanic.name || lastShownNearestMechanic?.name} continua a ser o mecânico disponível mais próximo que já lhe foi apresentado.
                {nextNearestMechanic
                  ? ` Deseja selecioná-lo ou escolher o mecânico seguinte, ${nextNearestMechanic.mechanic.name}?`
                  : " Não há outro mecânico disponível a seguir a este neste momento."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => { void selectNearestMechanicOption(nextNearestMechanic?.mechanic); }}
                disabled={!nextNearestMechanic}
              >
                Selecionar o seguinte
              </Button>
              <Button
                type="button"
                className="bg-orange-600 hover:bg-orange-700"
                onClick={() => { void selectNearestMechanicOption(nearestMechanic?.mechanic); }}
                disabled={!nearestMechanic}
              >
                Selecionar este
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ProviderProfileModal
          provider={selectedProviderProfile}
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          onSelect={(provider) => {
            const mechanic = onlineMechanics.find((item) => item.id === provider.id);
            if (!mechanic) {
              toast.error("Este mecânico não está mais disponível na lista.");
              setProfileModalOpen(false);
              return;
            }
            void selectMechanic(mechanic);
            setProfileModalOpen(false);
          }}
          onChat={(provider) => {
            setSelectedProviderProfile(provider);
            setChatModalOpen(true);
          }}
        />

        {chatModalOpen && lastCreatedRequestId && selectedProviderProfile && (
          <ChatModal
            requestId={lastCreatedRequestId}
            currentUserId={user?.id || ""}
            otherUserId={selectedProviderProfile.id || ""}
            otherUserName={selectedProviderProfile.name || "Prestador"}
            otherUserAvatar={selectedProviderProfile.avatar}
            isProvider={false}
            onClose={() => setChatModalOpen(false)}
          />
        )}

        {chatModalOpenForExisting && selectedRequestForChat && selectedProviderProfile && (
          <ChatModal
            requestId={selectedRequestForChat.id}
            currentUserId={user?.id || ""}
            otherUserId={selectedProviderProfile.id || selectedRequestForChat.providerId || ""}
            otherUserName={selectedProviderProfile.name || customerName || "Prestador"}
            otherUserAvatar={selectedProviderProfile.avatar}
            isProvider={false}
            onClose={handleChatClose}
          />
        )}

        {supportTicketModalOpen && (
          <SupportTicketDetailsModal
            isOpen={supportTicketModalOpen}
            ticketId={supportTicketIdToShow}
            onClose={() => {
              setSupportTicketModalOpen(false);
              setSupportTicketIdToShow(null);
            }}
            apiClient={apiClient}
          />
        )}

        {/* Help Modal */}
        <HelpModal
          isOpen={helpModalOpen}
          onClose={() => setHelpModalOpen(false)}
          userId={user?.id || null}
        />
        <Dialog open={deleteRequestConfirmOpen} onOpenChange={(open) => setDeleteRequestConfirmOpen(open)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Eliminar solicitação atual</DialogTitle>
              <DialogDescription>
                Precisa eliminar a solicitação atual para fazer outra. Deseja eliminar esta solicitação?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-end">
              <Button variant="outline" onClick={() => setDeleteRequestConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteCurrentRequest}
                disabled={isSelectedMechanicAtCustomer()}
              >
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <BlockRequestModal
          isOpen={blockModalOpen}
          onClose={() => setBlockModalOpen(false)}
          onSubmit={submitBlock}
          title="Enviar motivo da eliminação"
        />
        <BlockedReasonModal isOpen={blockedReasonOpen} onClose={() => setBlockedReasonOpen(false)} reason={blockedReasonText} />
        <RateMechanicModal
          isOpen={rateModalOpen}
          onClose={() => { setRateModalOpen(false); setRateModalRequestId(null); setRateModalMechanicId(null); setRateModalMechanicName(null); fetchUserRequests().catch(() => {}); }}
          requestId={rateModalRequestId}
          mechanicId={rateModalMechanicId}
          mechanicName={rateModalMechanicName}
          onSubmitted={() => { fetchUserRequests().catch(() => {}); navigate('/services'); }}
        />
        {reviewModalData && (
          <ReviewPublishedModal
            isOpen={reviewModalOpen}
            onClose={() => { setReviewModalOpen(false); setReviewModalData(null); }}
            rating={reviewModalData.rating}
            comment={reviewModalData.comment}
            mechanicName={reviewModalData.mechanicName}
          />
        )}
      </div>
    </div>
  );
}