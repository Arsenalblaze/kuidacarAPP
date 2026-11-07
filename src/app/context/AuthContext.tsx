import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiClient } from "../utils/api";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "customer" | "provider" | "admin" | "super_admin";
  avatar?: string;
  // Campos específicos do prestador
  providerType?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  documentType?: string;
  documentUrl?: string;
  providerLocation?: {
    lat: number;
    lng: number;
  } | null;
  rating?: number;
  completedServices?: number;
  isOnline?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, role: "customer" | "provider" | "admin" | "super_admin") => Promise<void>;
  register: (data: RegisterData) => Promise<{ needsConfirmation?: boolean }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "customer" | "provider";
  providerType?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  documentType?: string;
  documentUrl?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Mantém o usuário autenticado enquanto a sessão real do Supabase estiver válida.
  // Não força logout apenas ao abrir a página ou recuperar o estado do navegador.
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = apiClient.getAccessToken();
        const browserAllowed = apiClient.isSessionAllowedInThisBrowser();

        if (!browserAllowed) {
          console.warn('⚠️ Sessão vinculada a outro navegador. A autenticação local foi bloqueada neste browser.');
          apiClient.clearSessionStorage();
          setUser(null);
          setIsLoading(false);
          return;
        }

        if (token) {
          console.log('🔍 Verificando sessão existente...');
          const response = await apiClient.getSession();

          if (response.success && response.user) {
            const storedUserId = apiClient.getStoredSessionUserId();
            if (storedUserId && storedUserId !== response.user.id) {
              console.warn('⚠️ Usuário persistido no browser diverge da sessão ativa. Atualizando identidade do browser.');
            }

            apiClient.setStoredSessionUserId(response.user.id);
            console.log('✅ Sessão válida encontrada para:', response.user.name);
            setUser(response.user);
            return;
          }

          console.log('ℹ️ Token encontrado, mas não há sessão ativa válida. Mantendo usuário como não autenticado sem forçar logout explícito.');
          setUser(null);
          return;
        }

        const storedUserId = apiClient.getStoredSessionUserId();
        if (storedUserId) {
          console.log('ℹ️ Há identidade de usuário persistida no browser, mas sem token ativo. Mantendo sessão local registrada para o mesmo navegador.');
        }

        console.log('ℹ️ Nenhum token encontrado, usuário não autenticado');
        setUser(null);
      } catch (error) {
        console.warn("⚠️ Não foi possível validar a sessão. Mantendo o estado atual sem expulsar o usuário automaticamente:", error);
        setUser((currentUser) => currentUser ?? null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  useEffect(() => {
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) return;

    apiClient.setAdminPresence(user.id, true).then((response) => {
      if (!response.success) {
        console.warn("Não foi possível marcar o administrador como online:", response.error);
      }
    });
  }, [user?.id, user?.role]);

  const login = async (email: string, password: string, role: "customer" | "provider" | "admin" | "super_admin") => {
    try {
      console.log('🔐 Iniciando login para:', email, 'role:', role);
      setIsLoading(true);

      console.log('📡 Chamando apiClient.login...');
      const response = await apiClient.login(email, password);

      console.log('📥 Resposta do login:', response);

      if (response.success && response.user) {
        apiClient.setStoredSessionUserId(response.user.id);
        console.log('✅ Login bem-sucedido, definindo usuário:', response.user);
        setUser(response.user);
      } else {
        console.log('❌ Login falhou, resposta:', response);
        throw new Error(response.error || "Erro no login");
      }
    } catch (error: any) {
      console.error("❌ Erro completo no login:", error);
      console.error("Tipo do erro:", typeof error);
      console.error("Propriedades do erro:", Object.keys(error));
      console.error("Mensagem do erro:", error.message);
      console.error("Stack trace:", error.stack);

      // Tentar extrair mensagem mais específica
      let errorMessage = "Erro desconhecido";
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.response) {
        errorMessage = `Erro ${error.response.status}: ${error.response.statusText}`;
      }

      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    try {
      setIsLoading(true);
      const response = await apiClient.register(data);

      if (response.success) {
        // O cadastro deve apenas criar a conta e enviar o link de verificação.
        // O login só ocorre depois da confirmação do e-mail.
        console.log('✅ Cadastro criado com sucesso, aguardando confirmação por email');
        return { needsConfirmation: true };
      } else {
        throw new Error(response.error || "Erro no registro");
      }
    } catch (error: any) {
      console.error("Register error:", error);
      throw new Error(error.message || "Erro ao criar conta");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (user?.role === "admin" || user?.role === "super_admin") {
        const presenceResponse = await apiClient.setAdminPresence(user.id, false);
        if (!presenceResponse.success) {
          console.warn("Não foi possível marcar o administrador como offline:", presenceResponse.error);
        }
      }
      await apiClient.logout();
      apiClient.clearSessionStorage();
      setUser(null);
    } catch (error) {
      console.error('Erro ao terminar sessão:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível terminar sessão.');
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      const response = await apiClient.updateProfile(data);
      if (!response.success || !response.user) {
        throw new Error(response.error || "Não foi possível atualizar o perfil.");
      }
      setUser(response.user);
    } catch (error) {
      console.error("Update profile error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    console.warn("useAuth foi chamado fora do AuthProvider. Usando fallback não autenticado.");

    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: async () => undefined,
      register: async () => ({ needsConfirmation: false }),
      logout: async () => undefined,
      updateProfile: async () => undefined,
    } as AuthContextType;
  }

  return context;
}