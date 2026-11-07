import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../context/AuthContext";
import { apiClient, supabase } from "../utils/api";
import { RealTimeMap } from "../components/RealTimeMap";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { ChatModal } from "../components/ChatModal";
import { NotificationBell } from "../components/NotificationBell";
import BlockRequestModal from "../components/BlockRequestModal";
import BlockedReasonModal from "../components/BlockedReasonModal";
import ErrorBoundary from "../components/ErrorBoundary";
import { playMessageSound, useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import {
  MapPin,
  Clock,
  DollarSign,
  Star,
  CheckCircle,
  User,
  ArrowLeft,
  Navigation,
  RefreshCw,
  MessageCircle,
  Phone,
  Send,
  X,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { PLATFORM_COMMISSION_PERCENTAGE } from "../utils/commission";
import ReviewsList from "../components/ReviewsList";
import RateMechanicModal from "../components/RateMechanicModal";
import { usePushNotifications } from "../hooks/usePushNotifications";

interface ServiceRequest {
  id: string;
  type: string;
  description: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  estimatedPrice: number;
  price?: number;
  status: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  providerId?: string;
  createdAt: string;
}

export default function ProviderDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<ServiceRequest[]>([]);
  const [inProgressRequests, setInProgressRequests] = useState<ServiceRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'inProgress'>('pending');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<[number, number]>([-8.8283, 13.2544]);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [selectedRequestForChat, setSelectedRequestForChat] = useState<ServiceRequest | null>(null);
  const [selectedTrackingRequest, setSelectedTrackingRequest] = useState<ServiceRequest | null>(null);
  const [trackingRoutePath, setTrackingRoutePath] = useState<Array<[number, number]> | undefined>(undefined);
  const [providerTravelSpeedKmh, setProviderTravelSpeedKmh] = useState(0);
  const [isProviderStopped, setIsProviderStopped] = useState(false);
  const providerMovementRef = useRef<{
    position: [number, number];
    sampledAt: number;
    lastMovementAt: number;
    speedKmh: number;
  } | null>(null);
  const arrivalNotificationsInFlightRef = useRef<Set<string>>(new Set());
  const arrivalNotificationsSentRef = useRef<Set<string>>(new Set());
  const currentLocationRef = useRef(currentLocation);
  currentLocationRef.current = currentLocation;
  const [customerName, setCustomerName] = useState<string>("");
  const [unreadRequestIds, setUnreadRequestIds] = useState<Set<string>>(new Set());
  const [adminMessagesOpen, setAdminMessagesOpen] = useState(false);
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [loadingAdminMessages, setLoadingAdminMessages] = useState(false);
  const [adminReplyDraft, setAdminReplyDraft] = useState("");
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<string | null>(null);
  const [showDeleteAllAdminMessagesConfirm, setShowDeleteAllAdminMessagesConfirm] = useState(false);
  const [sendingAdminReply, setSendingAdminReply] = useState(false);
  const [adminRecipientId, setAdminRecipientId] = useState<string | null>(null);
  const [adminSenderEmail, setAdminSenderEmail] = useState<string>(user?.email || '');
  const [totalFinalizedPrice, setTotalFinalizedPrice] = useState<number>(0);
  const [totalFinalizedCount, setTotalFinalizedCount] = useState<number>(0);
  const [ratingAverage, setRatingAverage] = useState<number>(0);
  const [ratingTotalReviews, setRatingTotalReviews] = useState<number>(0);
  const [providerDebt, setProviderDebt] = useState<number>(0);
  const [providerCreditBalance, setProviderCreditBalance] = useState<number>(0);
  const [creditPromptPending, setCreditPromptPending] = useState(false);
  const [isProviderBlocked, setIsProviderBlocked] = useState<boolean>(false);
  const [providerBlockReason, setProviderBlockReason] = useState<string | null>(null);
  const [showDebtSection, setShowDebtSection] = useState<boolean>(true);
  const [monthlyDebtAverage, setMonthlyDebtAverage] = useState<number>(0);
  const [debtDueDate, setDebtDueDate] = useState<string | null>(null);
  const [paymentNumber, setPaymentNumber] = useState("929630902");
  const [paymentIban, setPaymentIban] = useState("0000 0055 3033 2012 1011 7");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'multicaixa' | 'iban'>('multicaixa');
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentPanelOpen, setPaymentPanelOpen] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [blockModalOpen, setBlockModalOpen] = useState<boolean>(false);
  const [blockingRequestId, setBlockingRequestId] = useState<string | null>(null);
  const [blockingTargetUserId, setBlockingTargetUserId] = useState<string | null>(null);
  const [blockedReasonOpen, setBlockedReasonOpen] = useState<boolean>(false);
  const [blockedReasonText, setBlockedReasonText] = useState<string | null>(null);
  const [rateModalOpen, setRateModalOpen] = useState<boolean>(false);
  const [rateModalRequestId, setRateModalRequestId] = useState<string | null>(null);
  const [rateModalMechanicId, setRateModalMechanicId] = useState<string | null>(null);
  const [rateModalMechanicName, setRateModalMechanicName] = useState<string | null>(null);
  // Re-auth states: used when the client session exists but no `profiles` row
  const [reauthModalOpen, setReauthModalOpen] = useState<boolean>(false);
  const [reauthEmail, setReauthEmail] = useState<string>(user?.email || "");
  const [reauthPassword, setReauthPassword] = useState<string>("");
  const [reauthLoading, setReauthLoading] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const resendTimerRef = useRef<number | null>(null);

  const openBlockModal = (requestId: string, targetUserId: string | null) => {
    const request = pendingRequests.find((item) => String(item.id) === String(requestId));
    if (!request || String(request.status || '').toLowerCase() !== 'pending') {
      toast.error('Só pode recusar uma solicitação enquanto ela estiver na área Pendentes.');
      return;
    }

    setBlockingRequestId(requestId);
    setBlockingTargetUserId(targetUserId);
    setBlockModalOpen(true);
  };

  const submitBlock = async (reason: string) => {
    if (!blockingRequestId) return;

    try {
      const request = pendingRequests.find((item) => String(item.id) === String(blockingRequestId));
      if (!request || String(request.status || '').toLowerCase() !== 'pending') {
        throw new Error('Só pode recusar uma solicitação enquanto ela estiver na área Pendentes.');
      }

      const payload: any = {
        isBlocked: true,
        blockedBy: user?.id || 'unknown',
        blockedReason: reason,
        blockedAt: new Date().toISOString(),
        status: 'blocked',
      };

      const response = await apiClient.updateServiceRequest(blockingRequestId, payload);
      if (response.success) {
        // make provider available after refusing/blocking a request
        try {
          await apiClient.setProviderStatus(user?.id || '', 'available');
        } catch (err) {
          console.warn('Não foi possível definir prestador como disponível:', err);
        }
        if (blockingTargetUserId) {
          try {
            await apiClient.sendMessage(
              blockingRequestId,
              blockingTargetUserId,
              `O mecânico eliminou a solicitação. Motivo: ${reason}`,
            );
          } catch (err) {
            console.warn('Não foi possível enviar mensagem de eliminação ao cliente:', err);
          }

          try {
            await apiClient.createNotification({
              userId: blockingTargetUserId,
              requestId: blockingRequestId,
              type: 'request_blocked',
              title: 'Solicitação bloqueada',
              message: `Motivo: ${reason}`,
              payload: { reason, requestId: blockingRequestId },
            });
          } catch (err) {
            console.warn('Não foi possível enviar notificação de bloqueio:', err);
          }
        }

        setPendingRequests(prev => prev.filter((r) => r.id !== blockingRequestId));
        try { await fetchPendingRequests(false); } catch (e) { /* ignore */ }
        toast.success('Solicitação bloqueada e motivo enviado');
      }
    } catch (err: any) {
      console.error('Erro ao aplicar bloqueio:', err);
      toast.error(err?.message || 'Erro ao bloquear solicitação');
    } finally {
      setBlockModalOpen(false);
      setBlockingRequestId(null);
      setBlockingTargetUserId(null);
    }
  };

  // Open blocked-reason modal when a request involving this provider is blocked
  useEffect(() => {
    const allRequests = [...pendingRequests, ...inProgressRequests];
    const blocked = allRequests.find(r => (r as any).is_blocked && (r as any).providerId === user?.id);
    if (blocked) {
      setBlockedReasonText((blocked as any).blockedReason || null);
      setBlockedReasonOpen(true);
    }
  }, [pendingRequests, inProgressRequests, user?.id]);


  // Helper function para calcular tempo decorrido
  const getTimeAgo = (dateString: string): string => {
    const now = new Date().getTime();
    const past = new Date(dateString).getTime();
    const diffMinutes = Math.floor((now - past) / 60000);
    
    if (diffMinutes < 1) return "agora mesmo";
    if (diffMinutes === 1) return "1 minuto";
    if (diffMinutes < 60) return `${diffMinutes} minutos`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return "1 hora";
    if (diffHours < 24) return `${diffHours} horas`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1 dia";
    return `${diffDays} dias`;
  };

  const formatMoney = (value: number) => {
    return `${new Intl.NumberFormat('pt-BR').format(value)} Kz`;
  };

  const getDebtCountdown = () => {
    if (!debtDueDate) return null;

    const debtDateMs = new Date(debtDueDate).getTime();
    if (!Number.isFinite(debtDateMs)) return null;

    const elapsedDays = Math.max(0, Math.floor((Date.now() - debtDateMs) / (24 * 60 * 60 * 1000)));
    return Math.max(0, 7 - elapsedDays);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const getDistanceKmBetweenPoints = (from: [number, number], to: [number, number]) => {
    const earthRadiusKm = 6371;
    const dLat = toRadians(to[0] - from[0]);
    const dLng = toRadians(to[1] - from[1]);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(from[0])) *
        Math.cos(toRadians(to[0])) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  };

  const isProviderAtCustomer = (request: ServiceRequest) => {
    if (!currentLocation || !request.location) return false;
    if (!Number.isFinite(request.location.lat) || !Number.isFinite(request.location.lng)) return false;
    if (!request.location.lat || !request.location.lng) return false;
    return getDistanceKmBetweenPoints(currentLocation, [request.location.lat, request.location.lng]) <= 0.001;
  };

  useEffect(() => {
    if (!user || !isOnline || !currentLocation) return;

    for (const request of inProgressRequests) {
      const customerLocation = request.location;
      if (!customerLocation || !Number.isFinite(customerLocation.lat) || !Number.isFinite(customerLocation.lng)) continue;
      if (!customerLocation.lat || !customerLocation.lng) continue;

      const distanceMeters = getDistanceKmBetweenPoints(
        currentLocation,
        [customerLocation.lat, customerLocation.lng],
      ) * 1000;
      const stages: Array<'nearby' | 'arrived'> = [];
      if (distanceMeters <= 15) stages.push('nearby');
      if (distanceMeters <= 1) stages.push('arrived');

      for (const stage of stages) {
        const notificationKey = `${request.id}:${stage}`;
        if (
          arrivalNotificationsSentRef.current.has(notificationKey) ||
          arrivalNotificationsInFlightRef.current.has(notificationKey)
        ) continue;

        arrivalNotificationsInFlightRef.current.add(notificationKey);
        void apiClient.notifyAdminsProviderArrival({
          id: request.id,
          providerId: user.id,
          providerName: user.name || 'Mecânico',
          customerName: request.customerName,
          distanceMeters,
          stage,
        }).then((response) => {
          if (!response.success) {
            console.error('Não foi possível avisar os administradores sobre a chegada:', response.error);
            return;
          }
          arrivalNotificationsSentRef.current.add(notificationKey);
        }).catch((error) => {
          console.error('Erro ao avisar os administradores sobre a chegada:', error);
        }).finally(() => {
          arrivalNotificationsInFlightRef.current.delete(notificationKey);
        });
      }
    }
  }, [currentLocation, inProgressRequests, isOnline, user]);

  const [selectedRouteSummary, setSelectedRouteSummary] = useState<{
    distance: string;
    duration: string;
    distanceKm: number;
  } | null>(null);
  const [isRoadRouteUnavailable, setIsRoadRouteUnavailable] = useState(false);

  const handleRouteCalculated = (distance: string, duration: string, distanceKm?: number, isFallback?: boolean) => {
    if (isFallback || typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) {
      setSelectedRouteSummary(null);
      setIsRoadRouteUnavailable(true);
      return;
    }
    setSelectedRouteSummary({ distance, duration, distanceKm });
    setIsRoadRouteUnavailable(false);
  };

  const getProviderTravelDuration = () => {
    if (isProviderStopped) return 'Parado';
    if (!selectedRouteSummary) return 'Calculando...';
    if (providerTravelSpeedKmh <= 0) return selectedRouteSummary.duration;

    const remainingMinutes = Math.max(
      1,
      Math.ceil((selectedRouteSummary.distanceKm / providerTravelSpeedKmh) * 60),
    );
    return `${remainingMinutes} min`;
  };

  const updateProviderMovement = (newLocation: [number, number]) => {
    const now = Date.now();
    const previousSample = providerMovementRef.current;
    if (!previousSample) {
      providerMovementRef.current = {
        position: newLocation,
        sampledAt: now,
        lastMovementAt: now,
        speedKmh: 0,
      };
      return;
    }

    const distanceKm = getDistanceKmBetweenPoints(previousSample.position, newLocation);
    const elapsedHours = (now - previousSample.sampledAt) / (60 * 60 * 1000);
    if (distanceKm >= 0.012 && elapsedHours > 0) {
      const measuredSpeedKmh = distanceKm / elapsedHours;
      const smoothedSpeedKmh = previousSample.speedKmh > 0
        ? previousSample.speedKmh * 0.5 + measuredSpeedKmh * 0.5
        : measuredSpeedKmh;
      providerMovementRef.current = {
        position: newLocation,
        sampledAt: now,
        lastMovementAt: now,
        speedKmh: smoothedSpeedKmh,
      };
      setProviderTravelSpeedKmh(smoothedSpeedKmh);
      setIsProviderStopped(false);
      return;
    }

    providerMovementRef.current = {
      ...previousSample,
      position: newLocation,
      sampledAt: now,
    };
  };

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    setNotifications,
  } = useRealtimeNotifications(user?.id ?? null, {
    autoRemindMs: 25000,
    onNewNotification: (notification) => {
      if (notification.type === 'new_service_request') {
        toast.success(notification.message);
      }
      if (notification.type === 'request_accepted') {
        toast.success(notification.message);
      }
    },
  });

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await apiClient.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId));
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
    isSupported: isPushSupported,
    subscription: pushSubscription,
    permission: pushPermission,
    requestPermission: requestPushPermission,
    subscribeToPush,
    sendTestNotification: sendPushTestNotification,
  } = usePushNotifications(user?.id ?? null);

  const handleEnablePushNotifications = async () => {
    try {
      const result = pushPermission === 'default'
        ? await requestPushPermission()
        : pushPermission;
      if (result !== 'granted') {
        toast.error('Permissão para notificações negada');
        return;
      }

      if (!pushSubscription) {
        await subscribeToPush();
        toast.success('✅ Notificações push ativadas! Você receberá alertas mesmo com o app fechado.');
      }
    } catch (error) {
      console.error('Erro ao ativar notificações push:', error);
      toast.error('Erro ao ativar notificações push');
    }
  };

  useEffect(() => {
    if (isPushSupported && pushPermission !== 'granted' && pushPermission !== 'denied') {
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
  }, [isPushSupported, pushPermission, user?.id]);

  const handleTestPushNotification = async () => {
    try {
      await sendPushTestNotification();
      toast.success('Notificação de teste enviada!');
    } catch (error) {
      console.error('Erro ao enviar notificação de teste:', error);
      toast.error('Erro ao enviar notificação de teste');
    }
  };

  // Reiniciar a deteção de movimento e o estado da rota ao trocar de solicitação.
  useEffect(() => {
    if (!selectedTrackingRequest) {
      setTrackingRoutePath(undefined);
      setSelectedRouteSummary(null);
      setIsRoadRouteUnavailable(false);
      providerMovementRef.current = null;
      setProviderTravelSpeedKmh(0);
      setIsProviderStopped(false);
      return;
    }

    const destination: [number, number] = [
      selectedTrackingRequest.location.lat,
      selectedTrackingRequest.location.lng,
    ];
    const now = Date.now();
    providerMovementRef.current = {
      position: currentLocationRef.current,
      sampledAt: now,
      lastMovementAt: now,
      speedKmh: 0,
    };
    setSelectedRouteSummary(null);
    setIsRoadRouteUnavailable(false);
    setProviderTravelSpeedKmh(0);
    setIsProviderStopped(false);

    const stoppedInterval = window.setInterval(() => {
      const movement = providerMovementRef.current;
      if (movement && Date.now() - movement.lastMovementAt >= 15000) {
        setProviderTravelSpeedKmh(0);
        setIsProviderStopped(true);
      }
    }, 5000);

    return () => {
      window.clearInterval(stoppedInterval);
    };
  }, [selectedTrackingRequest?.id]);

  useEffect(() => {
    if (!selectedTrackingRequest) {
      setTrackingRoutePath(undefined);
      return;
    }

    setTrackingRoutePath([
      currentLocation,
      [selectedTrackingRequest.location.lat, selectedTrackingRequest.location.lng],
    ]);
  }, [currentLocation, selectedTrackingRequest?.id]);

  // Buscar solicitações pendentes
  const fetchProviderSuspensionStatus = async () => {
    if (!user) return;

    try {
      const { data: kvRow, error: kvError } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value, is_online, provider_location')
        .eq('key', `user:${user.id}`)
        .maybeSingle();

      if (kvError && !['42P01', 'PGRST116'].includes(String(kvError.code || ''))) {
        console.warn('⚠️ Não foi possível verificar bloqueio em KV do prestador:', kvError.message);
      }

      const kvValue = kvRow?.value && typeof kvRow.value === 'object' ? kvRow.value : {};
      const kvDebtValue = Number(kvValue.debt ?? kvValue.debt_amount ?? 0) || 0;
      const debtDateValue = kvValue.debt_due_date ?? kvValue.debtDueDate ?? null;
      const debtDueDateMs = debtDateValue ? new Date(debtDateValue).getTime() : Number.NaN;
      const debtPassedDeadline = kvDebtValue > 0 && (
        !Number.isFinite(debtDueDateMs) ||
        Date.now() - debtDueDateMs >= 7 * 24 * 60 * 60 * 1000
      );
      const kvBlocked = Boolean(
        kvValue.kv_blocked ||
        kvValue.is_blocked ||
        kvValue.isBlocked ||
        kvValue.blocked ||
        kvValue.blocked_reason ||
        String(kvValue.status || '').toLowerCase() === 'blocked' ||
        debtPassedDeadline
      );
      const reason = kvValue.blocked_reason || (debtPassedDeadline ? 'Dívida em atraso' : 'Conta suspensa ou bloqueada');

      setIsProviderBlocked(kvBlocked);
      setProviderBlockReason(kvBlocked ? reason : null);
      if (kvBlocked) {
        setIsOnline(false);
        setPendingRequests([]);
        if (kvRow?.is_online || kvValue.isOnline || kvValue.is_online || kvRow?.provider_location) {
          const response = await apiClient.setProviderStatus(user.id, 'offline');
          if (!response.success) {
            throw new Error(response.error || 'Não foi possível desligar a disponibilidade do mecânico bloqueado.');
          }
        }
      }
    } catch (error: any) {
      console.warn('⚠️ Falha ao consultar bloqueio do prestador em KV:', error?.message || error);
    }
  };

  const fetchPendingRequests = async (showToast = false, force = false) => {
    if (!user || isProviderBlocked) {
      setPendingRequests([]);
      return;
    }

    if (!force && !showToast && pendingRequests.length > 0) {
      return;
    }

    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);

      const response = await apiClient.getPendingServices();

      if (response.success && response.requests) {
        // Mostrar apenas solicitações pendentes destinadas a este provider (providerId === user.id)
        const availableRequests = response.requests.filter((request: ServiceRequest) =>
          request.status?.toLowerCase() === 'pending' && String(request.providerId) === String(user.id)
        );
        setPendingRequests(availableRequests);
        if (showToast && availableRequests.length > 0) {
          toast.success(`${availableRequests.length} solicitações disponíveis`);
        }
      }
    } catch (error: any) {
      console.error("Erro ao buscar solicitações:", error);
      if (showToast) {
        toast.error("Erro ao atualizar solicitações");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchInProgressRequests = async (force = false) => {
    if (!user || isProviderBlocked) {
      setInProgressRequests([]);
      return;
    }

    if (!force && inProgressRequests.length > 0) {
      return;
    }

    try {
      const response = await apiClient.getUserServices(user.id);
      if (response.success && response.requests) {
        // Mostrar apenas solicitações onde o provider é o usuário atual
        const providerTasks = response.requests.filter(
          (request: ServiceRequest) =>
            request.providerId === user.id &&
            request.status?.toLowerCase() !== 'pending' &&
            !['blocked', 'cancelled', 'canceled', 'rejected', 'declined'].includes(request.status?.toLowerCase() || '') &&
            request.status !== 'completed' &&
            request.status !== 'finalizado'
        );
        const providerTasksWithCustomerNames = await Promise.all(providerTasks.map(async (request: ServiceRequest) => {
          if (request.customerName || !request.customerId) return request;

          try {
            const customerResponse = await apiClient.getUserById(request.customerId);
            return {
              ...request,
              customerName: customerResponse.success ? customerResponse.user?.name : undefined,
            };
          } catch (error) {
            console.warn(`Não foi possível carregar o nome do cliente da solicitação ${request.id}:`, error);
            return request;
          }
        }));
        setInProgressRequests(providerTasksWithCustomerNames);
      }
    } catch (error: any) {
      console.error("Erro ao buscar serviços em andamento:", error);
    }
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

  const fetchProviderAdminMessages = async () => {
    if (!user) return;

    setLoadingAdminMessages(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("receiver_id", user.id)
        .neq("sender_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setAdminMessages(data || []);

      if (data && data.length > 0) {
        const unreadIds = data.filter((message) => !message.is_read).map((message) => message.request_id || message.id);
        if (unreadIds.length > 0) {
          setUnreadRequestIds((prev) => new Set([...prev, ...unreadIds]));
        }
      }
    } catch (error: any) {
      console.error("Erro ao carregar mensagens do administrador:", error);
      setAdminMessages([]);
      toast.error(error?.message || "Erro ao carregar mensagens do administrador.");
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

  const handleSendMessageToAdmin = async () => {
    if (!user) {
      toast.error("Você precisa estar autenticado para enviar mensagem ao administrador.");
      return;
    }

    const trimmed = adminReplyDraft.trim();
    if (!trimmed) {
      toast.error("Escreva uma mensagem antes de enviar.");
      return;
    }

    const receiverIds = await resolveAdminRecipientIds();
    if (!receiverIds.length || receiverIds.every((id) => !id || id === 'admin-local')) {
      toast.error("Nenhum administrador disponível para receber a mensagem.");
      return;
    }

    setSendingAdminReply(true);

    try {
      const sentMessages: any[] = [];

      for (const receiverId of receiverIds) {
        if (!receiverId || receiverId === 'admin-local') continue;

        try {
          const response = await apiClient.sendMessage(
            `provider-admin-${user?.id ?? 'anon'}-${Date.now()}-${receiverId}`,
            receiverId,
            trimmed
          );

          if (response.success) {
            sentMessages.push(response.message);
          }
        } catch (err) {
          console.warn('Envio para admin falhou, tentando fallback direto:', err);

          const anonId = `msg-anon-${Date.now()}-${Math.random().toString(36).slice(2,8)}-${receiverId}`;
          const payload: any = {
            id: anonId,
            request_id: null,
            sender_id: user?.id ?? null,
            receiver_id: receiverId,
            content: trimmed,
            is_read: false,
            created_at: new Date().toISOString(),
          };

          if (!user && adminSenderEmail) {
            payload.sender_email = adminSenderEmail.trim().toLowerCase();
          }

          const { data, error } = await supabase.from('messages').insert(payload).select().single();
          if (error) {
            console.error('Erro ao inserir mensagem direta para admin:', error);
            continue;
          }

          sentMessages.push(data);
        }
      }

      if (sentMessages.length > 0) {
        setAdminMessages((current) => {
          const list = [...sentMessages, ...current];
          const deduped = list.filter((message, index, arr) => arr.findIndex((item) => item?.id === message?.id) === index);
          return deduped;
        });
        setAdminReplyDraft("");
        toast.success(`Mensagem enviada para ${sentMessages.length} administrador(es).`);
      } else {
        throw new Error('Nenhum administrador recebeu a mensagem.');
      }
    } catch (error: any) {
      console.error("Erro ao enviar mensagem para o administrador:", error);
      toast.error(error?.message || "Erro ao enviar mensagem ao administrador.");
    } finally {
      setSendingAdminReply(false);
    }
  };

  const handleOpenProviderMessages = async () => {
    if (!user) {
      toast.error("Você precisa estar autenticado para enviar mensagem ao administrador.");
      return;
    }

    const nextState = !adminMessagesOpen;
    setAdminMessagesOpen(nextState);

    if (nextState) {
      await resolveAdminRecipientId();
      await fetchProviderAdminMessages();
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("receiver_id", user.id)
        .eq("is_read", false)
        .neq("sender_id", user.id);
    }
  };

  const handleDeleteProviderMessage = async (messageId: string) => {
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

  const handleDeleteAllProviderMessages = async () => {
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

  const clearUnreadForRequest = (requestId: string) => {
    setUnreadRequestIds((prev) => {
      const next = new Set(prev);
      next.delete(requestId);
      return next;
    });
  };

  // Carregar solicitações ao montar o componente
  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const refreshProviderDebtState = async () => {
    if (!user) return;
    await Promise.all([
      fetchProviderDebt(),
      fetchProviderSuspensionStatus(),
    ]);
  };

  const refreshProviderRealtimeState = async () => {
    if (!user) return;
    await Promise.all([
      fetchProviderDebt(),
      fetchProviderSuspensionStatus(),
      fetchPendingRequests(),
    ]);
  };

  const fetchProviderDebt = async () => {
    if (!user) return;

    try {
      const response = await apiClient.getProviderDebt(user.id);
      if (!response.success) return;

      const nextDebt = Number(response.debt) || 0;
      const nextDueDate = response.debtDueDate || null;

      setProviderDebt(nextDebt);
      setDebtDueDate(nextDueDate);
      setProviderCreditBalance(Number(response.creditBalance) || 0);
      setCreditPromptPending(Boolean(response.creditPromptPending));

      if (nextDebt > 0) {
        const debtDateValue = nextDueDate ? new Date(nextDueDate).getTime() : Date.now();
        const elapsedDays = nextDueDate ? Math.max(0, Math.floor((Date.now() - debtDateValue) / (24 * 60 * 60 * 1000))) : 0;
        const remainingDays = Math.max(0, 7 - elapsedDays);
        if (remainingDays <= 0) {
          setProviderBlockReason((current) => current || 'Dívida em atraso');
        }
      }
    } catch (error: any) {
      console.warn('Erro ao buscar dívida do mecânico:', error?.message || error);
    }
  };

  const handleResolveCredit = async (applyToDebt: boolean) => {
    if (!user?.id) return;
    const response = await apiClient.resolveProviderCredit(user.id, applyToDebt);
    if (!response.success) {
      toast.error(response.error || 'Não foi possível atualizar o saldo positivo.');
      return;
    }

    setProviderDebt(response.debt);
    setProviderCreditBalance(response.creditBalance);
    setCreditPromptPending(false);
    await fetchProviderSuspensionStatus();
    toast.success(applyToDebt
      ? response.appliedToDebt > 0
        ? `Saldo aplicado à dívida. Restam ${formatMoney(response.debt)} de dívida e ${formatMoney(response.creditBalance)} de saldo.`
        : `O saldo será aplicado a dívidas futuras. Saldo disponível: ${formatMoney(response.creditBalance)}.`
      : 'Saldo positivo mantido na sua conta.');
  };

  const handleDeleteOwnCredit = async () => {
    if (!user?.id || !window.confirm('Deseja eliminar o seu saldo positivo? Esta ação não pode ser desfeita.')) return;
    const response = await apiClient.clearProviderCredit(user.id);
    if (!response.success) {
      toast.error(response.error || 'Não foi possível eliminar o saldo positivo.');
      return;
    }
    setProviderCreditBalance(0);
    setCreditPromptPending(false);
    toast.success('Saldo positivo eliminado.');
  };

  useEffect(() => {
    if (user) {
      fetchProviderSuspensionStatus();
      fetchPendingRequests();
      fetchInProgressRequests(true);
      fetchUnreadRequestIds();
      fetchProviderDebt();
      apiClient.saveCurrentUserToKvStore().catch((error) => {
        console.warn('⚠️ Não foi possível salvar auth.user no KV store ao carregar dashboard:', error?.message || error);
      });
      // Atualiza chegada de GPS e salva provider_location + is_online
      requestProviderLocation();
      loadPaymentSettings();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const kvChannel = supabase
      .channel(`provider_kv_debt_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kv_store_9dc5328a', filter: `key=eq.user:${user.id}` },
        (payload) => {
          const nextValue = payload?.new?.value && typeof payload.new.value === 'object' ? payload.new.value : {};
          const nextBlocked = Boolean(
            nextValue.kv_blocked ||
            nextValue.is_blocked ||
            nextValue.isBlocked ||
            nextValue.blocked ||
            nextValue.blocked_reason ||
            String(nextValue.status || '').toLowerCase() === 'blocked'
          );

          if (nextBlocked) {
            setIsProviderBlocked(true);
            setIsOnline(false);
            setPendingRequests([]);
            setProviderBlockReason(nextValue.blocked_reason || 'Conta suspensa ou bloqueada');
            void apiClient.setProviderStatus(user.id, 'offline').catch((error) => {
              console.error('Não foi possível desligar o mecânico bloqueado:', error);
            });
          }

          refreshProviderRealtimeState().catch(() => {});
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'kv_store_9dc5328a', filter: `key=eq.user:${user.id}` },
        (payload) => {
          const nextValue = payload?.new?.value && typeof payload.new.value === 'object' ? payload.new.value : {};
          const nextBlocked = Boolean(
            nextValue.kv_blocked ||
            nextValue.is_blocked ||
            nextValue.isBlocked ||
            nextValue.blocked ||
            nextValue.blocked_reason ||
            String(nextValue.status || '').toLowerCase() === 'blocked'
          );

          if (nextBlocked) {
            setIsProviderBlocked(true);
            setIsOnline(false);
            setPendingRequests([]);
            setProviderBlockReason(nextValue.blocked_reason || 'Conta suspensa ou bloqueada');
            void apiClient.setProviderStatus(user.id, 'offline').catch((error) => {
              console.error('Não foi possível desligar o mecânico bloqueado:', error);
            });
          }

          refreshProviderRealtimeState().catch(() => {});
        }
      )
      .subscribe();

    const suspensionCheck = window.setInterval(() => {
      void fetchProviderSuspensionStatus();
    }, 60_000);

    return () => {
      window.clearInterval(suspensionCheck);
      if (typeof kvChannel.unsubscribe === 'function') {
        kvChannel.unsubscribe();
      }
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(kvChannel);
      }
    };
  }, [user]);

  const loadPaymentSettings = async () => {
    try {
      const response = await apiClient.getSystemSettings();
      if (response.success && response.settings) {
        setPaymentNumber(response.settings.multicaixaNumber || response.settings.defaultMulticaixaNumber || '929630902');
        setPaymentIban(response.settings.paymentIban || '0000 0055 3033 2012 1011 7');
      }
    } catch (error) {
      console.warn('Erro ao carregar configurações de pagamento:', error);
    }
  };

  const handleSubmitPaymentReference = async () => {
    if (!user) return;
    if (!paymentReference.trim()) {
      toast.error('Informe a referência do pagamento.');
      return;
    }

    // If there is a selected tracking request, use its price/estimatedPrice as the payment amount
    let amount = parseFloat(paymentAmount.replace(',', '.')) || 0;
    if (selectedTrackingRequest?.id) {
      amount = Number(selectedTrackingRequest.price || selectedTrackingRequest.estimatedPrice || amount) || 0;
    }

    if (amount <= 0) {
      toast.error('Informe um valor de pagamento válido.');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const requestId = selectedTrackingRequest?.id ?? `provider-payment-${Date.now()}`;


      await apiClient.submitPaymentReference(requestId, paymentReference.trim(), amount, user.id, selectedPaymentMethod);

      if (selectedTrackingRequest?.id) {
        try {
          await apiClient.updateServiceRequest(selectedTrackingRequest.id, {
            paymentReference: paymentReference.trim(),
            paymentAmount: amount,
            paymentMethod: selectedPaymentMethod,
          });
        } catch (updateError: any) {
          console.warn('Não foi possível salvar pagamento direto em service_requests:', updateError?.message || updateError);
        }
      }

      setPaymentStatus('pending');
      toast.success('✅ Referência enviada. O administrador irá confirmar em breve.');
      setPaymentReference('');
      setPaymentAmount('');
      fetchProviderDebt();
    } catch (error: any) {
      console.error('Erro ao enviar referência de pagamento:', error);
      toast.error(error?.message || 'Não foi possível enviar a referência.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`unread_messages_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        (payload) => {
          const newRecord = (payload as any).new;
          if (newRecord?.request_id) {
            setUnreadRequestIds((prev) => new Set([...prev, newRecord.request_id]));
          }
          if (newRecord && String(newRecord.receiver_id) === String(user.id) && String(newRecord.sender_id) !== String(user.id)) {
            playMessageSound();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        (payload) => {
          const oldRecord = (payload as any).old;
          if (oldRecord?.request_id) {
            setUnreadRequestIds((prev) => {
              const next = new Set(prev);
              next.delete(oldRecord.request_id);
              return next;
            });
          }
          // also remove from adminMessages list if present
          if (oldRecord?.id) {
            setAdminMessages((current) => current.filter((m) => m.id !== oldRecord.id));
          }
        }
      )
      .subscribe();

    return () => {
      if (typeof channel.unsubscribe === 'function') {
        channel.unsubscribe();
      }
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel);
      }
    };
  }, [user]);

  // Realtime: atualizar estatísticas ao receber novas avaliações para este prestador
  useEffect(() => {
    if (!user) return;

    const mechChannel = supabase
      .channel(`mechanic_reviews_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mechanic_reviews', filter: `mechanic_id=eq.${user.id}` },
        (payload) => {
          try {
            // Simplesmente refetch das estatísticas para manter consistência com o servidor
            fetchProviderStatistics().catch((err) => console.warn('Erro ao atualizar estatísticas via realtime:', err));
            // Opcional: notificar o prestador quando houver nova avaliação
            if ((payload as any).eventType === 'INSERT' || (payload as any).new) {
              toast.success('Nova avaliação recebida');
            }
          } catch (err) {
            console.warn('Erro no handler realtime mechanic_reviews:', err);
          }
        }
      )
      .subscribe();

    return () => {
      try { mechChannel.unsubscribe(); } catch (_) {}
      try { if (typeof supabase.removeChannel === 'function') supabase.removeChannel(mechChannel); } catch (_) {}
    };
  }, [user]);

  const requestProviderLocation = async (): Promise<[number, number] | null> => {
    if (!user || isProviderBlocked) {
      setIsOnline(false);
      return null;
    }

    if (!navigator.geolocation) {
      toast.error("Seu navegador não suporta geolocalização.");
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const newLocation: [number, number] = [
            position.coords.latitude,
            position.coords.longitude,
          ];

          updateProviderMovement(newLocation);
          setCurrentLocation(newLocation);

          if (user) {
            try {
              await apiClient.updateProviderStatus(true, {
                lat: newLocation[0],
                lng: newLocation[1],
              });
              setIsOnline(true);
              toast.success("Localização salva. Você está online.");
            } catch (error) {
              setIsOnline(false);
              void fetchProviderSuspensionStatus();
              console.error("Erro ao salvar localização do prestador:", error);
            }
          }

          resolve(newLocation);
        },
        (error) => {
          console.error("Erro de localização:", error);
          toast.error("Permissão de localização negada. Ative para ficar online.");
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
        }
      );
    });
  };

  const fetchProviderStatistics = async () => {
    if (!user) return;

    try {
      const priceResponse = await apiClient.getTotalFinalizedPrice(user.id).catch(() => ({ success: false }));
      const countResponse = await apiClient.getTotalFinalizedCount(user.id).catch(() => ({ success: false }));
      const ratingResponse = await apiClient.getMechanicRatingStats(user.id).catch(() => ({ success: false, average: 0, total: 0 }));
      const monthlyDebtResponse = await apiClient.getProviderMonthlyDebtAverage(user.id).catch(() => ({ success: false, averageDebt: 0 }));

      if (priceResponse.success) {
        setTotalFinalizedPrice(priceResponse.totalPrice);
      }

      if (countResponse.success) {
        setTotalFinalizedCount(countResponse.totalCount);
      }

      if (ratingResponse && ratingResponse.success) {
        setRatingAverage(Number(ratingResponse.average) || 0);
        setRatingTotalReviews(Number(ratingResponse.total) || 0);
      }

      if (monthlyDebtResponse.success) {
        setMonthlyDebtAverage(Number(monthlyDebtResponse.averageDebt) || 0);
      }

      const now = new Date();
      const currentDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const lastDayRef = (window as any).__kuidacarDailyStatsDay;
      if (lastDayRef && lastDayRef !== currentDay) {
        setTotalFinalizedPrice(0);
        setTotalFinalizedCount(0);
      }
      (window as any).__kuidacarDailyStatsDay = currentDay;

      console.log('✅ Estatísticas atualizadas:', {
        totalPrice: priceResponse.totalPrice,
        totalCount: countResponse.totalCount
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    const midnightResetCheck = () => {
      const now = new Date();
      const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const lastDay = (window as any).__kuidacarDailyStatsDay;

      if (lastDay && lastDay !== dayKey) {
        setTotalFinalizedPrice(0);
        setTotalFinalizedCount(0);
      }

      (window as any).__kuidacarDailyStatsDay = dayKey;
    };

    midnightResetCheck();

    if (user.isOnline) {
      setIsOnline(true);
    }
    requestProviderLocation();
    fetchProviderStatistics();

    const resetInterval = setInterval(midnightResetCheck, 60000);
    return () => clearInterval(resetInterval);
  }, [user]);

  // Atualizações de solicitações ficam em realtime; não há polling automático da lista.

  // Atualizar localização real e salvar no kv_store a cada 5 segundos quando online
  useEffect(() => {
    if (!isOnline || !user) return;

    const locationInterval = setInterval(async () => {
      if (!navigator.geolocation) return;

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          });
        });

        const newLocation: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];

        updateProviderMovement(newLocation);
        setCurrentLocation(newLocation);

        // Salvar localização no kv_store via updateProviderStatus
        await apiClient.updateProviderStatus(true, {
          lat: newLocation[0],
          lng: newLocation[1],
        });

        console.log('📍 Localização atualizada no kv_store:', newLocation);
      } catch (error) {
        console.warn('⚠️ Erro ao obter localização para atualização:', error);
      }
    }, 5000); // Atualizar localização a cada 5 segundos

    return () => clearInterval(locationInterval);
  }, [isOnline, user]);

  // Atualizar estatísticas a cada 15 segundos quando online
  useEffect(() => {
    if (!isOnline || !user) return;

    const statisticsInterval = setInterval(() => {
      fetchProviderStatistics();
    }, 15000); // 15 segundos

    return () => clearInterval(statisticsInterval);
  }, [isOnline, user]);

  // Monitorar localização em tempo real quando acompanhando uma solicitação
  useEffect(() => {
    if (!selectedTrackingRequest || !navigator.geolocation) {
      return;
    }

    // Watch position for real-time updates
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const newLocation: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];

        setCurrentLocation(newLocation);

        // Atualizar status do provedor com nova localização no KV store
        if (user) {
          await apiClient.updateProviderStatus(true, {
            lat: newLocation[0],
            lng: newLocation[1],
          }).catch((error) => {
            console.warn('Erro ao atualizar localização em tempo real:', error);
          });
        }
      },
      (error) => {
        console.error("Erro ao monitorar localização:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 5000,
      }
    );

    setWatchId(watchId);

    // Additional interval to force location update every 5 seconds
    const locationInterval = setInterval(async () => {
      try {
        // Get fresh location from geolocation
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          });
        });

        const newLocation: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];

        setCurrentLocation(newLocation);

        // Save to API
        if (user) {
          await apiClient.updateProviderStatus(true, {
            lat: newLocation[0],
            lng: newLocation[1],
          }).catch((error) => {
            console.warn('Erro ao atualizar localização no intervalo:', error);
          });
        }

        // Also fetch the latest location from API (in case updated from other sources)
        if (user) {
          try {
            const response = await apiClient.getProviderLocationById(user.id);
            if (response.success && response.location) {
              const apiLocation: [number, number] = [
                response.location.lat,
                response.location.lng,
              ];
              setCurrentLocation(apiLocation); // Update with API location
            }
          } catch (error) {
            console.warn('Erro ao buscar localização da API:', error);
          }
        }
      } catch (error) {
        console.warn('Erro ao obter localização no intervalo:', error);
      }
    }, 5000);

    // Limpar o watch e interval quando desmontar ou quando selectedTrackingRequest mudar
    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(locationInterval);
      setWatchId(null);
    };
  }, [selectedTrackingRequest, user]);

  // Supabase Real-Time: Monitorar novas solicitações pendentes e atualizações
  useEffect(() => {
    if (!user || !isOnline) return;

    console.log('🔔 Configurando subscrição em tempo real para novas solicitações...');

    const subscription = supabase
      .channel('public:service_requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'service_requests',
          filter: 'status=eq.pending',
        },
        (payload) => {
          console.log('🔔 Nova solicitação recebida em tempo real:', payload.new);
          
          // Mostrar somente se a solicitação for destinada a este provider
          if (!payload.new.provider_id || String(payload.new.provider_id) !== String(user?.id)) {
            console.log('ℹ️ Solicitação não destinada a este provider, ignorando na aba pendentes');
            return;
          }

          const newRequest = {
            id: payload.new.id,
            type: payload.new.type,
            description: payload.new.description,
            location: payload.new.location,
            estimatedPrice: payload.new.estimated_price,
            status: payload.new.status,
            customerId: payload.new.customer_id,
            providerId: payload.new.provider_id,
            createdAt: payload.new.created_at,
          };

          setPendingRequests((prev) => {
            if (prev.some((r) => r.id === newRequest.id)) return prev;
            return [newRequest, ...prev];
          });

          toast.success('📍 Nova solicitação destinada a você!');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'service_requests',
        },
        (payload) => {
          console.log('🔄 Solicitação atualizada em tempo real:', payload.new);
          
          // If request was blocked, show reason modal to provider and remove from lists
          if (payload.new.is_blocked) {
            if (!payload.new.provider_id || String(payload.new.provider_id) !== String(user?.id)) {
              // Not meant for this provider
              return;
            }
            setPendingRequests((prev) => prev.filter((r) => r.id !== payload.new.id));
            setInProgressRequests((prev) => prev.filter((r) => r.id !== payload.new.id));
            setBlockedReasonText(payload.new.blocked_reason || null);
            setBlockedReasonOpen(true);
            toast.info('Solicitação bloqueada — motivo recebido');
            return;
          }

          // Se a solicitação recebeu um provider_id diferente deste provider, remover de "pendentes"
          if (payload.new.provider_id && String(payload.new.provider_id) !== String(user?.id)) {
            console.log('ℹ️ Solicitação foi atribuída a outro provider, removendo de pendentes');
            setPendingRequests((prev) => prev.filter((r) => r.id !== payload.new.id));
          }
          
          // Se o status deixou de ser 'pending', remover de "pendentes"
          if (payload.new.status !== 'pending') {
            console.log('ℹ️ Solicitação deixou de ser pendente, removendo da lista');
            setPendingRequests((prev) => prev.filter((r) => r.id !== payload.new.id));
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔕 Cancelando subscrição em tempo real');
      if (typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(subscription);
      }
    };
  }, [user, isOnline]);

  const handleAcceptRequest = async (requestId: string) => {
    try {
      // Primeiro, garantir que temos a localização atual
      if (!currentLocation) {
        await requestProviderLocation();
        // Aguardar um pouco para obter a localização
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const response = await apiClient.updateServiceRequest(requestId, {
        status: "accepted", // Padronizado: accepted em vez de 'aceite'
        providerId: user?.id,
      });

      if (response.success) {
        // Atualizar localização do prestador na solicitação
        if (currentLocation) {
          await apiClient.updateServiceRequest(requestId, {
            providerLocation: {
              lat: currentLocation[0],
              lng: currentLocation[1]
            }
          });
        }

        // Buscar dados do cliente para o chat
        const request = pendingRequests.find(r => r.id === requestId);
        if (request && request.customerId) {
          try {
            const customerProfile = await apiClient.getUserById(request.customerId);
            setCustomerName(customerProfile.user?.name || "Cliente");
          } catch (err) {
            setCustomerName("Cliente");
          }
        }

        if (user) {
          await apiClient.createNotification({
            userId: user.id,
            requestId,
            type: 'provider_confirmation',
            title: 'Você aceitou o pedido',
            message: 'Você aceitou o pedido. O cliente está aguardando sua chegada.',
            payload: { requestId },
          }).catch((error) => {
            console.warn('Não foi possível salvar notificação do prestador:', error);
          });
        }

        if (request?.customerId) {
          await apiClient.createNotification({
            userId: request.customerId,
            requestId,
            type: 'request_accepted',
            title: 'O prestador aceitou o seu pedido',
            message: 'O prestador aceitou seu pedido e está a caminho.',
            payload: { requestId },
          }).catch((error) => {
            console.warn('Não foi possível salvar notificação do cliente:', error);
          });

          // Enviar notificação push ao cliente
          try {
            const { data, error } = await supabase.functions.invoke('send-push-notification', {
              body: {
                userId: request.customerId,
                title: 'O prestador aceitou o seu pedido',
                message: 'O prestador aceitou seu pedido e está a caminho.',
                url: `/request?highlight=${requestId}`,
                requestId
              }
            });

            if (error) {
              console.warn('Erro ao enviar push notification:', error);
            } else {
              console.log('Push notification enviada:', data);
            }
          } catch (pushError) {
            console.warn('Erro ao enviar push notification:', pushError);
          }
        }

        toast.success("✅ Solicitação aceite! Abrindo chat...");
        
        // Abrir o chat automaticamente
        setSelectedRequestForChat(request || null);
        setChatModalOpen(true);
        
        // Remove from pending and refresh in-progress
        setPendingRequests(prev => prev.filter((r) => r.id !== requestId));
        await fetchInProgressRequests(true);
      }
    } catch (error: any) {
      console.error("Erro ao aceitar solicitação:", error);
      toast.error(`❌ ${error.message || "Erro ao aceitar solicitação"}`);
    }
  };

  const handleChatClose = () => {
    setChatModalOpen(false);
    setSelectedRequestForChat(null);
  };

  const openChatForRequest = (request: ServiceRequest) => {
    setSelectedRequestForChat(request);
    setCustomerName(request.customerName || "Cliente");
    setChatModalOpen(true);
  };

  const handleTrackRequest = async (request: ServiceRequest) => {
    if (navigator.geolocation) {
      await requestProviderLocation();
    }

    // Buscar nome do cliente se não estiver disponível
    let customerName = request.customerName;
    if (!customerName && request.customerId) {
      try {
        const customerProfile = await apiClient.getUserById(request.customerId);
        customerName = customerProfile.user?.name || "Cliente";
      } catch (err) {
        customerName = "Cliente";
      }
    }

    // Adicionar customerName ao request
    const requestWithCustomerName = {
      ...request,
      customerName: customerName
    };

    setSelectedTrackingRequest(requestWithCustomerName);
  };

  // O painel do prestador não depende de `profiles` para estado dinâmico.
  // O estado real do prestador continua em `kv_store_9dc5328a`.

  const handleReauthSubmit = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!reauthEmail) {
      toast.error('Informe o email para receber o link de confirmação.');
      return;
    }

    setReauthLoading(true);
    try {
      const cleanEmail = reauthEmail.trim().toLowerCase();
      const redirectTo = `${window.location.origin}/provider`;
      const { data, error } = await supabase.auth.signInWithOtp({ email: cleanEmail, options: { emailRedirectTo: redirectTo } });

      if (error) {
        console.error('Erro ao enviar magic link:', error);
        toast.error(error.message || 'Erro ao enviar link de confirmação');
        return;
      }

      toast.success(`Link de confirmação enviado para ${cleanEmail}. Verifique seu e‑mail.`);
      setReauthModalOpen(false);
    } catch (err: any) {
      console.error('Erro no handleReauthSubmit (magic link):', err);
      toast.error(err?.message || 'Erro ao processar pedido de confirmação.');
    } finally {
      setReauthLoading(false);
    }
  };

  const startResendCooldown = (seconds: number) => {
    setResendCooldown(seconds);
    if (resendTimerRef.current) {
      window.clearInterval(resendTimerRef.current);
    }
    resendTimerRef.current = window.setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) {
            window.clearInterval(resendTimerRef.current);
            resendTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000) as unknown as number;
  };

  const handleResendLink = async () => {
    if (resendCooldown > 0) return;
    if (!reauthEmail) {
      toast.error('Informe o email para reenviar o link.');
      return;
    }

    setReauthLoading(true);
    try {
      const cleanEmail = reauthEmail.trim().toLowerCase();
      const redirectTo = `${window.location.origin}/provider`;
      const { data, error } = await supabase.auth.signInWithOtp({ email: cleanEmail, options: { emailRedirectTo: redirectTo } });
      if (error) {
        console.error('Erro ao reenviar magic link:', error);
        toast.error(error.message || 'Erro ao reenviar link');
        return;
      }

      toast.success(`Link reenviado para ${cleanEmail}.`);
      startResendCooldown(60);
    } catch (err: any) {
      console.error('Erro no handleResendLink:', err);
      toast.error(err?.message || 'Erro ao reenviar link');
    } finally {
      setReauthLoading(false);
    }
  };

  const handleCloseRoutePanel = () => {
    setSelectedTrackingRequest(null);
    setSelectedRouteSummary(null);
    setIsRoadRouteUnavailable(false);
    setProviderTravelSpeedKmh(0);
    setIsProviderStopped(false);
    providerMovementRef.current = null;
    setTrackingRoutePath(undefined);
  };

  const handleSelectPendingTab = () => {
    handleCloseRoutePanel();
    setActiveTab('pending');
  };

  const handleDeleteRequest = async (requestId: string) => {
    const request = inProgressRequests.find((r) => String(r.id) === String(requestId));
    if (!request) {
      toast.error('Só pode recusar ou eliminar uma solicitação enquanto ela estiver na área Pendentes.');
      return;
    }
    if (String(request?.status || '').toLowerCase() === 'awaiting_customer_confirmation') {
      toast.error('A solicitação aguarda a confirmação do cliente e não pode ser eliminada pelo mecânico.');
      return;
    }
    if (request && isProviderAtCustomer(request)) {
      toast.error('Não é possível eliminar a solicitação: o mecânico já chegou ao local do cliente.');
      return;
    }
    const customerId = request?.customerId || request?.customer_id || null;

    try {
      if (!customerId) {
        throw new Error('Não foi possível identificar o cliente. A solicitação continua ativa.');
      }

      const message = 'O mecânico solicitou o cancelamento desta solicitação. Para cancelar, elimine-a na sua página de cliente. A solicitação continua ativa até essa confirmação.';
      const results = await Promise.allSettled([
        apiClient.sendMessage(requestId, customerId, message),
        apiClient.createNotification({
          userId: customerId,
          requestId,
          type: 'request_deletion_requested',
          title: 'Pedido para cancelar solicitação',
          message,
          payload: { requestId, requestedBy: user?.id || null },
        }),
      ]);
      if (!results.some((result) => result.status === 'fulfilled')) {
        throw new Error('Não foi possível notificar o cliente. A solicitação continua ativa.');
      }
      if (results.some((result) => result.status === 'rejected')) {
        console.warn('Uma das formas de notificação do pedido de cancelamento falhou:', results);
      }
      toast.success('O cliente foi avisado. Aguarde que ele cancele a solicitação na página dele; será notificado quando isso acontecer.');
    } catch (error: any) {
      console.error('Erro ao eliminar solicitação:', error);
      toast.error(`❌ ${error.message || 'Erro ao eliminar solicitação'}`);
    }
  };

  const handleFinalizeRequest = async (requestId: string) => {
    try {
      const localRequest = [...inProgressRequests, ...pendingRequests].find(r => r.id === requestId);
      const customerId = localRequest?.customerId || localRequest?.customer_id || null;
      if (String(localRequest?.status || '').toLowerCase() === 'awaiting_customer_confirmation') {
        toast.info('A solicitação já aguarda a confirmação do cliente.');
        return;
      }
      if (!customerId) {
        throw new Error('Não foi possível identificar o cliente para pedir a confirmação.');
      }

      const confirmMsg = `Confirma que o serviço foi concluído? O cliente será notificado e a comissão de ${PLATFORM_COMMISSION_PERCENTAGE}% só será registada depois da confirmação dele.`;
      if (!window.confirm(confirmMsg)) return;

      const response = await apiClient.updateServiceRequest(requestId, {
        status: 'awaiting_customer_confirmation',
      });
      if (response.success) {
        const message = 'O mecânico informou que concluiu o serviço. Confirme a conclusão na sua página para encerrar a solicitação. A dívida só será registada após a sua confirmação.';
        const results = await Promise.allSettled([
          apiClient.sendMessage(requestId, customerId, message),
          apiClient.createNotification({
            userId: customerId,
            requestId,
            type: 'request_finalized_by_provider',
            title: 'Confirmação pendente do cliente',
            message,
            payload: { requestId, finalizedBy: user?.id || null },
          }),
        ]);
        if (!results.some((result) => result.status === 'fulfilled')) {
          throw new Error('A solicitação aguarda confirmação, mas não foi possível notificar o cliente.');
        }
        if (results.some((result) => result.status === 'rejected')) {
          console.warn('Uma das formas de notificação de conclusão falhou:', results);
        }

        await fetchInProgressRequests(true);
        toast.success('Conclusão enviada ao cliente. A solicitação e a dívida aguardam a confirmação dele.');
      }
    } catch (error: any) {
      console.error('Erro ao finalizar solicitação:', error);
      toast.error(`❌ ${error.message || 'Erro ao finalizar solicitação'}`);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'accepted':
      case 'aceite':
        return 'Aceito';
      case 'onway':
        return 'A caminho';
      case 'arrived':
        return 'Chegou';
      case 'awaiting_customer_confirmation':
        return 'A aguardar confirmação do cliente';
      case 'completed':
      case 'finalizado':
        return 'Finalizado';
      case 'rejected':
      case 'recusado':
        return 'Recusado';
      default:
        return status;
    }
  };

  const handleUpdateRequestStatus = async (requestId: string, newStatus: string) => {
    try {
      const response = await apiClient.updateServiceRequest(requestId, {
        status: newStatus,
      });

      if (response.success) {
        const statusMessages = {
          onway: 'Iniciando deslocamento...',
          arrived: 'Chegou ao local!',
          completed: 'Serviço concluído!',
          rejected: 'Solicitação recusada!',
        };
        toast.success(`✅ ${statusMessages[newStatus as keyof typeof statusMessages] || 'Status atualizado'}`);

        if (newStatus === 'completed' || newStatus === 'finalizado') {
          setInProgressRequests(prev => prev.filter((r) => r.id !== requestId));
        } else {
          await fetchInProgressRequests(true);
        }
      }
    } catch (error: any) {
      console.error("Erro ao atualizar status da solicitação:", error);
      toast.error(`❌ ${error.message || "Erro ao atualizar status"}`);
    }
  };

  const debtCountdown = getDebtCountdown();
  const occupiedRequest = inProgressRequests[0] || null;
  const occupiedCustomerName = occupiedRequest?.customerName?.trim() || 'Cliente';

  return (<>
    {reauthModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <Card className="w-full max-w-md p-6">
          <h3 className="text-lg font-semibold mb-2">Confirme sua conta</h3>
          <p className="text-sm text-gray-600 mb-4">Pelo visto sua conta ainda não existe no banco. Enviaremos um link de confirmação para o seu e‑mail para concluir o cadastro.</p>
          <form onSubmit={(e) => { e.preventDefault(); handleReauthSubmit(); }} className="space-y-3">
            <div>
              <Label>E-mail</Label>
              <Input value={reauthEmail} onChange={(e) => setReauthEmail(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end items-center">
              <Button variant="ghost" onClick={() => { setReauthModalOpen(false); setReauthPassword(''); }}>Cancelar</Button>
              <Button type="button" variant="outline" onClick={handleResendLink} disabled={reauthLoading || resendCooldown > 0}>
                {resendCooldown > 0 ? `Reenviar (${resendCooldown}s)` : 'Reenviar'}
              </Button>
              <Button type="submit" disabled={reauthLoading}>{reauthLoading ? 'Enviando...' : 'Enviar link'}</Button>
            </div>
          </form>
        </Card>
      </div>
    )}

    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-orange-600 text-white p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="text-white hover:bg-orange-700"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-semibold">Painel do Prestador</h1>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onDeleteNotification={handleDeleteNotification}
              />
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
                onClick={async () => {
                  if (!window.confirm('Deseja mesmo sair da conta? Isso terminará a sua sessão atual.')) return;

                  // 1. Parar watchPosition se existir
                  if (watchId !== null) {
                    navigator.geolocation.clearWatch(watchId);
                    setWatchId(null);
                  }

                  // 2. Atualizar status para offline e limpar localização
                  try {
                    await apiClient.updateProviderStatus(false, null);
                  } catch (error) {
                    console.error("Erro ao atualizar status offline:", error);
                  }

                  // 3. Fazer logout
                  logout();

                  // 4. Toast e navegar
                  toast.success("Sessão encerrada com sucesso.");
                  navigate("/", { replace: true });
                }}
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Status Toggle */}
          <div className="bg-orange-700 rounded-lg p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${occupiedRequest ? "bg-amber-300" : isOnline ? "bg-green-400" : "bg-gray-400"} animate-pulse`}></div>
              <div className="flex flex-col">
                <span className="font-medium">{occupiedRequest ? "Ocupado" : isOnline ? "Conectado" : "Desconectado"}</span>
                {occupiedRequest && (
                  <span className="text-xs text-orange-100">
                    Em atendimento: {occupiedCustomerName}
                  </span>
                )}
              </div>
            </div>
            {providerDebt > 0 && showDebtSection ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/80">Sua dívida atual:</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white shadow-sm">
                    {formatMoney(providerDebt)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDebtSection(false)}
                    className="h-8 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/20"
                  >
                    Ocultar
                  </Button>
                </div>
                {debtDueDate && (
                  <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-orange-100">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span>Prazo de pagamento</span>
                      <span className="font-semibold text-white">{debtCountdown ?? 7}/7</span>
                    </div>
                    {debtCountdown === 0 ? (
                      <span>A sua conta está suspensa porque a dívida chegou a 0/7.</span>
                    ) : (
                      <span>O prazo é de 7 dias corridos a partir da primeira dívida em aberto. Pagamentos parciais reduzem o saldo, mas não reiniciam o prazo.</span>
                    )}
                  </div>
                )}
              </div>
            ) : null}
            {providerDebt > 0 && !showDebtSection && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDebtSection(true)}
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                Mostrar dívida e Multicaixa
              </Button>
            )}
            {(providerCreditBalance > 0 || creditPromptPending) && (
              <div className="w-full rounded-lg border border-emerald-200/30 bg-emerald-900/30 p-3 text-sm text-emerald-50">
                {providerCreditBalance > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Saldo positivo: <strong>{formatMoney(providerCreditBalance)}</strong></span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                      onClick={() => { void handleDeleteOwnCredit(); }}
                    >
                      Eliminar saldo
                    </Button>
                  </div>
                )}
                {creditPromptPending && (
                  <div className="mt-2 space-y-2">
                    <p>
                      Foi identificado um valor pago acima da dívida. Deseja usar o saldo para abater dívidas atuais ou futuras, ou mantê-lo como saldo positivo?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => { void handleResolveCredit(true); }}
                      >
                        Aplicar às dívidas
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                        onClick={() => { void handleResolveCredit(false); }}
                      >
                        Manter saldo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <Switch
              checked={isOnline}
              disabled={isProviderBlocked}
              onCheckedChange={async (checked) => {
                if (checked && isProviderBlocked) {
                  setIsOnline(false);
                  toast.error('A conta está bloqueada. Regularize a situação e aguarde a confirmação do administrador.');
                  return;
                }
                setIsOnline(checked);
                if (checked) {
                  await requestProviderLocation();
                } else {
                  if (user) {
                    await apiClient.updateProviderStatus(false, {
                      lat: currentLocation[0],
                      lng: currentLocation[1],
                    });
                  }
                  toast.success("Você está offline");
                }
              }}
            />
          </div>
        </div>
      </div>

      {isPushSupported && (pushPermission !== 'granted' || !pushSubscription) && (
        <div className="max-w-md mx-auto px-6 pb-3 pt-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 text-sm">🔔 Notificações Push</h3>
                <p className="text-blue-700 text-xs mt-1">
                  Receba alertas instantâneos mesmo com o app fechado
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEnablePushNotifications}
                  className="text-xs"
                  disabled={pushPermission === 'denied'}
                >
                  {pushPermission === 'denied' ? 'Bloqueado' : 'Permitir'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="max-w-md mx-auto px-6 pb-3 pt-3">
        <Button
          variant="outline"
          className="w-full justify-center gap-2 border-orange-200 bg-white text-orange-700 hover:bg-orange-50"
          onClick={handleOpenProviderMessages}
          disabled={!user}
        >
          <MessageCircle className="w-4 h-4" />
          {adminMessagesOpen ? "Ocultar mensagens" : "Mensagens"}
        </Button>
      </div>

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
            <ErrorBoundary fallback={<div className="text-sm text-gray-500">Erro ao renderizar mensagens do administrador.</div>}>
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setShowDeleteAllAdminMessagesConfirm(true)}>
                    Eliminar todas mensagens
                  </Button>
                </div>
                {adminMessages.map((message, index) => {
                  const safeKey = message?.id ?? `admin-message-${message?.request_id ?? 'unknown'}-${index}`;
                  return (
                    <div key={safeKey} className={`rounded-xl border p-3 ${message.is_read ? "border-gray-200 bg-gray-50" : "border-orange-200 bg-orange-50"}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-orange-700">
                            {new Date(message.created_at).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-black">{message.content}</p>
                        </div>
                        <div className="ml-3 flex-shrink-0">
                          <button
                            title="Remover mensagem"
                            onClick={() => setConfirmDeleteMessageId(message.id)}
                            className="rounded-full border border-red-200 bg-red-50 p-1 text-red-600 hover:bg-red-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {confirmDeleteMessageId === message.id && (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                          <p className="mb-3 text-sm font-medium text-red-700">Deseja eliminar esta mensagem?</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteProviderMessage(message.id)}>
                              Confirmar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setConfirmDeleteMessageId(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ErrorBoundary>
          )}

          {showDeleteAllAdminMessagesConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl border border-orange-200 bg-white p-5 shadow-xl">
                <p className="text-lg font-semibold text-gray-900">Eliminar todas as mensagens?</p>
                <p className="mt-2 text-sm text-gray-600">Esta ação remove todas as mensagens recebidas do administrador.</p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowDeleteAllAdminMessagesConfirm(false)}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleDeleteAllProviderMessages}>Confirmar</Button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 border-t border-orange-100 pt-4">
            {!user ? (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Você precisa estar autenticado para enviar mensagem ao administrador.
              </div>
            ) : (
              <Label htmlFor="provider-admin-message" className="mb-2 block text-sm font-medium text-gray-700">
                Escrever mensagem para o administrador
              </Label>
            )}
            {!user && (
              <div className="mb-2">
                <Label htmlFor="provider-admin-sender-email" className="mb-1 block text-sm font-medium text-gray-700">Seu e‑mail (para contato)</Label>
                <Input id="provider-admin-sender-email" value={adminSenderEmail} onChange={(e) => setAdminSenderEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
            )}
            <Textarea
              id="provider-admin-message"
              value={adminReplyDraft}
              onChange={(event) => setAdminReplyDraft(event.target.value)}
              placeholder={user ? "Digite sua mensagem para o administrador..." : "Faça login para escrever ao administrador..."}
              className="min-h-[90px] resize-none"
              disabled={!user}
            />
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                onClick={handleSendMessageToAdmin}
                disabled={sendingAdminReply || !adminReplyDraft.trim() || !user}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Send className="w-4 h-4" />
                {sendingAdminReply ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {isProviderBlocked && (
        <div className="max-w-md mx-auto px-6 pt-6">
          <Card className="border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2 text-red-600">
                <X className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-red-700">Conta suspensa ou bloqueada</h2>
                <p className="text-sm text-red-700">
                  A sua conta foi suspensa ou bloqueada e não pode visualizar solicitações pendentes nem em andamento.
                </p>
                <p className="text-sm text-red-700">
                  {providerBlockReason ? `Motivo: ${providerBlockReason}.` : 'Motivo: dívida em atraso ou situação administrativa.'} Pague a sua dívida para voltar a ficar ativo, ou contacte o administrador para regularizar a sua situação.
                </p>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-300 bg-white text-red-700 hover:bg-red-100"
                    onClick={() => setAdminMessagesOpen(true)}
                  >
                    Contactar administrador
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-md mx-auto p-6">
        {!isProviderBlocked && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="p-3 text-center">
              <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-xl font-bold">{formatMoney(totalFinalizedPrice)}</p>
              <p className="text-xs text-gray-600">Hoje</p>
            </Card>

            <Card className="p-3 text-center">
              <CheckCircle className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-xl font-bold">{totalFinalizedCount}</p>
              <p className="text-xs text-gray-600">Atendimentos</p>
            </Card>

            <Card className="p-3 text-center">
              <Star className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
              <p className="text-xl font-bold">{Number(ratingAverage).toFixed(1)}</p>
              <p className="text-xs text-gray-600">{ratingTotalReviews} avaliações</p>
            </Card>
          </div>
        )}

        <div className="max-w-md mx-auto w-full">
          {!isProviderBlocked && (
            <div className="mb-4">
              <ReviewsList mechanicId={user?.id || ""} initialLimit={6} />
            </div>
          )}
          {providerDebt > 0 && showDebtSection && (
            <Card className="overflow-hidden rounded-3xl border-2 border-dashed border-orange-300 transition-all duration-300">
              <div className="flex items-center justify-between gap-3 bg-orange-100 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setPaymentPanelOpen((prev) => !prev)}
                  className="flex flex-1 items-center justify-between gap-4 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-orange-700">
                      Pagamento {selectedPaymentMethod === 'iban' ? 'por IBAN' : 'Multicaixa Express'}
                    </p>
                    <p className="text-xs text-gray-600">
                      Clique para {paymentPanelOpen ? 'fechar' : 'abrir'} o painel de pagamento.
                    </p>
                  </div>
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-orange-300 bg-white text-orange-700 transition-transform duration-300 ${paymentPanelOpen ? 'rotate-180' : ''}`}>
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 8L10 12L14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant={selectedPaymentMethod === 'multicaixa' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedPaymentMethod('multicaixa');
                      setPaymentPanelOpen(true);
                    }}
                    className={selectedPaymentMethod === 'multicaixa' ? 'bg-orange-600 text-white hover:bg-orange-700' : ''}
                  >
                    Express
                  </Button>
                  <Button
                    type="button"
                    variant={selectedPaymentMethod === 'iban' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedPaymentMethod('iban');
                      setPaymentPanelOpen(true);
                    }}
                    className={selectedPaymentMethod === 'iban' ? 'bg-orange-600 text-white hover:bg-orange-700' : ''}
                  >
                    IBAN
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDebtSection(false)}
                  className="h-8 rounded-full border border-orange-300 bg-white px-3 text-xs font-medium text-orange-700 hover:bg-orange-50"
                >
                  Ocultar
                </Button>
              </div>

              <div className={`overflow-hidden transition-all duration-300 ${paymentPanelOpen ? 'max-h-[700px] py-5' : 'max-h-0 py-0'}`}>
                <div className="px-5">
                  <div className="space-y-4 text-sm text-gray-600 mb-4">
                    <p>
                      {selectedPaymentMethod === 'iban'
                        ? 'Faça a transferência para o IBAN abaixo e envie a referência e o valor do pagamento para o administrador confirmar.'
                        : 'Pague no Multicaixa utilizando o número abaixo e envie a referência do pagamento aqui nesta tabela para enviar ao administrador.'}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 mb-4">
                    <div>
                      <Label htmlFor="paymentDestination">
                        {selectedPaymentMethod === 'iban' ? 'IBAN' : 'Número Multicaixa'}
                      </Label>
                      <Input
                        id="paymentDestination"
                        value={selectedPaymentMethod === 'iban' ? paymentIban : paymentNumber}
                        readOnly
                        placeholder={selectedPaymentMethod === 'iban' ? 'IBAN não configurado' : '929630902'}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`paymentAmount-${selectedPaymentMethod}`}>Valor pago</Label>
                      <Input
                        id={`paymentAmount-${selectedPaymentMethod}`}
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                        placeholder="Ex: 100.00"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <Label htmlFor={`paymentReference-${selectedPaymentMethod}`}>Referência</Label>
                    <Input
                      id={`paymentReference-${selectedPaymentMethod}`}
                      value={paymentReference}
                      onChange={(event) => setPaymentReference(event.target.value)}
                      placeholder={`Informe a referência ${selectedPaymentMethod === 'iban' ? 'da transferência IBAN' : 'do Multicaixa'}`}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="text-sm text-gray-700">
                      Estado: <span className="font-semibold">{paymentStatus ?? 'Aguardando envio'}</span>
                    </div>
                    <Button
                      onClick={handleSubmitPaymentReference}
                      disabled={isSubmittingPayment || !isOnline}
                    >
                      {isSubmittingPayment ? 'Enviando...' : 'Enviar referência'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTab === 'pending'
                    ? 'bg-orange-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
                onClick={handleSelectPendingTab}
                disabled={isProviderBlocked}
              >
                Pendentes
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTab === 'inProgress'
                    ? 'bg-orange-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab('inProgress')}
                disabled={isProviderBlocked}
              >
                Em andamento
              </button>
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition"
                onClick={requestProviderLocation}
                disabled={!user || isProviderBlocked}
              >
                Conectar e obter a localização GPS
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchPendingRequests(true, true);
                fetchInProgressRequests(true);
              }}
              disabled={refreshing || !isOnline || isProviderBlocked}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {isProviderBlocked ? (
            <Card className="p-8 text-center border-red-200 bg-red-50">
              <p className="text-red-700 font-medium">A sua conta está suspensa ou bloqueada.</p>
              <p className="text-sm text-red-700 mt-2">
                Pague a dívida pendente para voltar a ficar ativo ou fale com o administrador por mensagem.
              </p>
            </Card>
          ) : !isOnline ? (
            <Card className="p-8 text-center">
              <p className="text-gray-600">
                Você está offline. Ative o modo online para ver solicitações.
              </p>
            </Card>
          ) : loading ? (
            <Card className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-600">Carregando solicitações...</p>
            </Card>
          ) : (
            <>
              {selectedTrackingRequest && currentLocation && currentLocation.length === 2 && currentLocation[0] !== 0 && currentLocation[1] !== 0 &&
                selectedTrackingRequest.location && selectedTrackingRequest.location.lat && selectedTrackingRequest.location.lng &&
                !isNaN(selectedTrackingRequest.location.lat) && !isNaN(selectedTrackingRequest.location.lng) &&
                selectedTrackingRequest.location.lat !== 0 && selectedTrackingRequest.location.lng !== 0 && (
                <div className="mb-6" ref={mapSectionRef}>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm text-gray-500">Acompanhar solicitação</p>
                      <h2 className="text-xl font-semibold">Rota até o cliente</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {selectedTrackingRequest.location.address}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCloseRoutePanel}
                        className="text-gray-500 hover:text-red-600"
                        title="Fechar painel de rota"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {(() => {
                    const providerLabel = user?.name || "Prestador";
                    const clientLabel = selectedTrackingRequest.customerName || "Cliente";
                    return (
                      <div className="h-80 bg-gradient-to-br from-blue-100 to-green-100 rounded-lg overflow-hidden">
                        <RealTimeMap
                          center={currentLocation}
                          zoom={14}
                          markers={[
                            {
                              position: [selectedTrackingRequest.location.lat, selectedTrackingRequest.location.lng],
                              title: clientLabel,
                              icon: "user",
                              color: "blue",
                              label: selectedTrackingRequest.customerName ? `Cliente: nome do cliente, cliente respectivo da solicitação: ${selectedTrackingRequest.customerName}` : "Cliente: nome do cliente, cliente respectivo da solicitação",
                            },
                            {
                              position: currentLocation,
                              title: providerLabel,
                              icon: "mechanic",
                              color: "green",
                              label: providerLabel,
                            },
                          ]}
                          routePath={trackingRoutePath}
                          height="320px"
                          onRouteCalculated={handleRouteCalculated}
                        />
                      </div>
                    );
                  })()}
                  {(selectedRouteSummary || isProviderStopped || isRoadRouteUnavailable) && (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                          <p className="text-xs uppercase font-semibold text-gray-500">Distância</p>
                          <p className="mt-1 text-lg font-semibold text-gray-900">
                            {selectedRouteSummary?.distance || (isRoadRouteUnavailable ? 'Indisponível' : 'Calculando...')}
                          </p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                          <p className="text-xs uppercase font-semibold text-gray-500">Duração</p>
                          <p className="mt-1 text-lg font-semibold text-gray-900">
                            {getProviderTravelDuration()}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-3 w-3 rounded-full bg-green-600" />
                            <span className="text-sm font-medium text-gray-900">{(() => user?.name || "Prestador")()}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-3 w-3 rounded-full bg-blue-600" />
                            <span className="text-sm font-medium text-gray-900">{(() => selectedTrackingRequest.customerName || "Cliente")()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Botão de finalizar e avaliar removido do painel do prestador */}
                </div>
              )}

              {activeTab === 'pending' && (
                pendingRequests.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Navigation className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">Nenhuma solicitação pendente</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Aguarde novos chamados na sua área.
                    </p>
                    <p className="text-xs text-gray-400 mt-3">
                      Atualização automática a cada 10 segundos
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {pendingRequests.map((request) => (
                      <Card key={request.id} className="p-4 border-2 border-green-200">
                        <div className="flex items-start justify-between mb-3 gap-4">
                          <div>
                            <Badge className="bg-blue-600 text-white mb-2">NOVO</Badge>
                            <h3 className="font-semibold text-lg capitalize">{request.type}</h3>
                            <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                          </div>
                          <Badge className="bg-green-600 text-white text-base px-3 py-1">
                            {request.estimatedPrice.toLocaleString()} Kz
                          </Badge>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span>{request.location.address}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>Há {getTimeAgo(request.createdAt)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            variant="outline"
                            onClick={() => openBlockModal(request.id, request.customerId)}
                          >
                            Recusar
                          </Button>
                          <Button
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleAcceptRequest(request.id)}
                          >
                            ✓ Aceitar
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              )}

              {activeTab === 'inProgress' && (
                inProgressRequests.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-gray-600">Você ainda não aceitou nenhum atendimento.</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Aceite um chamado para acompanhar seu serviço em andamento.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {inProgressRequests.map((request) => (
                      <Card key={request.id} className="p-4 border-2 border-orange-200">
                        <div className="flex items-start justify-between mb-3 gap-4">
                          <div>
                            <Badge className="bg-orange-600 text-white mb-2">
                              {getStatusLabel(request.status)}
                            </Badge>
                            <h3 className="font-semibold text-lg capitalize">{request.type}</h3>
                            <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                          </div>
                          <Badge className="bg-green-600 text-white text-base px-3 py-1">
                            {request.estimatedPrice.toLocaleString()} Kz
                          </Badge>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span>{request.location.address}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>Há {getTimeAgo(request.createdAt)}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            className="w-full sm:w-auto"
                            variant="outline"
                            onClick={() => handleTrackRequest(request)}
                          >
                            Acompanhar
                          </Button>
                          <Button
                            className="w-full sm:w-auto relative flex items-center gap-2"
                            variant="outline"
                            onClick={() => {
                              openChatForRequest(request);
                              clearUnreadForRequest(request.id);
                            }}
                          >
                            <MessageCircle className="w-4 h-4" />
                            Chat
                            {unreadRequestIds.has(request.id) && (
                              <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-white" />
                            )}
                          </Button>
                          <Button className="w-full sm:w-auto" variant="outline" asChild>
                            <a href={`tel:${request.customerPhone || ''}`} className="flex items-center gap-2 justify-center w-full sm:w-auto">
                              <Phone className="w-4 h-4" />
                              Fazer Chamada
                            </a>
                          </Button>
                          {/* Botões de status e ações */}
                          {(request.status === 'accepted' || request.status === 'aceite') && (
                            <Button className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700" onClick={() => handleUpdateRequestStatus(request.id, 'onway')}>
                              Deslocando...
                            </Button>
                          )}
                          {request.status === 'onway' && (
                            <Button className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700" onClick={() => handleUpdateRequestStatus(request.id, 'arrived')}>
                              Cheguei
                            </Button>
                          )}
                          {request.status !== 'completed' && request.status !== 'finalizado' && (
                            <>
                              <Button
                                className="w-full sm:w-auto"
                                variant="outline"
                                disabled={isProviderAtCustomer(request) || request.status === 'awaiting_customer_confirmation'}
                                onClick={() => handleDeleteRequest(request.id)}
                              >
                                {isProviderAtCustomer(request)
                                  ? 'No local do cliente'
                                  : request.status === 'awaiting_customer_confirmation'
                                    ? 'A aguardar cliente'
                                    : 'Pedir cancelamento'}
                              </Button>
                              {request.status === 'arrived' && (
                                <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700" onClick={() => handleFinalizeRequest(request.id)}>
                                  Pedir confirmação
                                </Button>
                              )}
                            </>
                          )}
                          {(request.status === 'completed' || request.status === 'finalizado') && (
                            <Button className="w-full sm:w-auto" variant="secondary" disabled>
                              ✓ Finalizado
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* Chat Modal */}
      {chatModalOpen && selectedRequestForChat && (
        <ChatModal
          requestId={selectedRequestForChat.id}
          currentUserId={user?.id || ""}
          otherUserId={selectedRequestForChat.customerId || ""}
          otherUserName={customerName}
          isProvider={true}
          onClose={handleChatClose}
        />
      )}
    </div>
      <BlockRequestModal isOpen={blockModalOpen} onClose={() => setBlockModalOpen(false)} onSubmit={submitBlock} />
      <BlockedReasonModal isOpen={blockedReasonOpen} onClose={() => setBlockedReasonOpen(false)} reason={blockedReasonText} />
        <RateMechanicModal
          isOpen={rateModalOpen}
          onClose={() => { setRateModalOpen(false); setRateModalRequestId(null); setRateModalMechanicId(null); setRateModalMechanicName(null); fetchPendingRequests().catch(() => {}); }}
          requestId={rateModalRequestId}
          mechanicId={rateModalMechanicId}
          mechanicName={rateModalMechanicName}
          onSubmitted={() => { fetchPendingRequests().catch(() => {}); fetchInProgressRequests().catch(() => {}); }}
        />
  </>);
}