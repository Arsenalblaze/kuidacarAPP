import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { translateAuthErrorMessage } from './authErrors';
import { getEmailConfirmationRedirect } from './authRedirects';
import { calculatePlatformCommission } from './commission';
import { logoutOneSignalIdentity } from './oneSignal';

// Cliente Supabase direto para acesso ao banco de dados
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
    },
  }
);

// Para desenvolvimento local, usar Supabase direto
// Para produção, usar Supabase direto também
const API_BASE_URL = `https://${projectId}.supabase.co`;

console.log('🌐 API Base URL:', API_BASE_URL);
console.log('🔗 Supabase Project ID:', projectId);

export const DEFAULT_SERVICE_CATALOG = [
  {
    id: 'reboque',
    name: 'Reboque',
    description: 'Transporte do seu veículo para oficina ou destino seguro',
    price: 15000,
    icon: 'truck',
    estimatedTime: '20-30 min',
    color: 'bg-red-500',
  },
  {
    id: 'mecanica',
    name: 'Mecânica Geral',
    description: 'Diagnóstico e reparos mecânicos no local',
    price: 15000,
    icon: 'wrench',
    estimatedTime: '30-60 min',
    color: 'bg-blue-500',
  },
  {
    id: 'pneus',
    name: 'Troca de Pneu',
    description: 'Substituição de pneu furado ou danificado',
    price: 6000,
    icon: 'car',
    estimatedTime: '15-20 min',
    color: 'bg-green-500',
  },
  {
    id: 'bateria',
    name: 'Problemas de Bateria',
    description: 'Carga ou substituição de bateria descarregada',
    price: 10000,
    icon: 'battery',
    estimatedTime: '15-25 min',
    color: 'bg-yellow-500',
  },
  {
    id: 'combustivel',
    name: 'Abastecimento',
    description: 'Entrega de combustível de emergência',
    price: 8000,
    icon: 'fuel',
    estimatedTime: '20-30 min',
    color: 'bg-purple-500',
  },
  {
    id: 'chaveiro',
    name: 'Chaveiro',
    description: 'Abertura de veículo ou cópia de chaves',
    price: 15000,
    icon: 'key',
    estimatedTime: '25-40 min',
    color: 'bg-orange-500',
  },
];

export const DEFAULT_FAQS = [
  {
    id: 'faq-default-1',
    pergunta: 'Como funciona o cadastro de prestador?',
    resposta: 'O prestador cria a conta, confirma o e-mail e pode começar a receber solicitações após ativar o painel e confirmar sua disponibilidade.',
    ordem: 1,
    ativa: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'faq-default-2',
    pergunta: 'Como confirmar o meu e-mail?',
    resposta: 'Após o cadastro, o sistema envia um link de validação para o seu e-mail. Abra o Gmail, clique no link e depois faça login normalmente.',
    ordem: 2,
    ativa: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'faq-default-3',
    pergunta: 'O que acontece se eu tiver dívida pendente?',
    resposta: 'O prestador pode receber uma mensagem de conta suspensa e não visualizar novas solicitações até regularizar a situação e entrar em contato com o administrador.',
    ordem: 3,
    ativa: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

class ApiClient {
  private accessToken: string | null = null;

  private normalizeUserRole(role?: string | null): string {
    if (!role) return 'customer';
    const normalized = String(role).trim().toLowerCase();
    if (normalized === 'client' || normalized === 'customer') return 'customer';
    if (normalized === 'provider' || normalized === 'mechanic') return 'provider';
    if (normalized === 'admin' || normalized === 'super_admin') return normalized;
    return normalized;
  }

  private isDebtOverdueForBlock(profile: any): boolean {
    const kvDebt = profile?.value?.debt ?? profile?.value?.debt_amount ?? null;
    const debtValue = Number(kvDebt ?? profile?.debt ?? profile?.debt_amount ?? 0) || 0;
    if (debtValue <= 0) return false;

    const dueDateValue = profile?.value?.debt_due_date
      ?? profile?.value?.debtDueDate
      ?? profile?.debt_due_date
      ?? profile?.debtDueDate
      ?? profile?.updated_at
      ?? profile?.created_at
      ?? null;
    if (!dueDateValue) return true;

    const dueDate = new Date(dueDateValue).getTime();
    if (Number.isNaN(dueDate)) return true;

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - dueDate >= sevenDaysMs;
  }

  private isProviderManuallyBlocked(profile: any): boolean {
    const value = profile?.value && typeof profile.value === 'object' ? profile.value : profile;
    return Boolean(
      value?.kv_blocked ||
      value?.is_blocked ||
      value?.isBlocked ||
      value?.blocked ||
      String(value?.status || '').toLowerCase() === 'blocked' ||
      value?.blocked_reason
    );
  }

  private isProviderBlockedForAvailability(profile: any): boolean {
    return this.isProviderManuallyBlocked(profile) || this.isDebtOverdueForBlock(profile);
  }

  private translateAuthError(message?: string): string {
    return translateAuthErrorMessage(message);
  }

  private getBrowserSignature(): string {
    const browserInfo = {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
      language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
      vendor: typeof navigator !== 'undefined' ? navigator.vendor : 'unknown',
    };

    return btoa(unescape(encodeURIComponent(JSON.stringify(browserInfo))));
  }

  getSessionBrowserSignature(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('kuidacar_session_browser');
  }

  getStoredSessionUserId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('kuidacar_session_user_id');
  }

  setStoredSessionUserId(userId: string | null) {
    if (typeof window === 'undefined') return;
    if (userId) {
      localStorage.setItem('kuidacar_session_user_id', userId);
    } else {
      localStorage.removeItem('kuidacar_session_user_id');
    }
  }

  isSessionAllowedInThisBrowser(): boolean {
    if (typeof window === 'undefined') return true;

    const savedBrowser = this.getSessionBrowserSignature();
    if (!savedBrowser) return true;

    return savedBrowser === this.getBrowserSignature();
  }

  clearSessionStorage(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('kuidacar_session_browser');
    localStorage.removeItem('kuidacar_session_user_id');
    console.log('🧹 Sessão local limpa para este navegador');
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('accessToken', token);
      localStorage.setItem('kuidacar_session_browser', this.getBrowserSignature());
      console.log('💾 Token salvo no localStorage:', token.substring(0, 30) + '...');
      console.log('🌐 Sessão vinculada ao navegador atual:', this.getBrowserSignature().substring(0, 24) + '...');
    } else {
      this.clearSessionStorage();
      console.log('🗑️ Token removido do localStorage');
    }
  }

  getAccessToken(): string | null {
    if (!this.accessToken) {
      const persistedToken = localStorage.getItem('accessToken');
      const savedBrowser = this.getSessionBrowserSignature();
      const currentBrowser = this.getBrowserSignature();

      if (persistedToken && savedBrowser && savedBrowser !== currentBrowser) {
        console.warn('⚠️ Sessão foi criada em outro navegador. Requisição bloqueada para este navegador.');
        this.clearSessionStorage();
        return null;
      }

      this.accessToken = persistedToken;
      console.log('📖 Token recuperado do localStorage:', this.accessToken ? this.accessToken.substring(0, 30) + '...' : 'NENHUM');
    }
    return this.accessToken;
  }

  // ============================================
  // AUTHENTICATION METHODS - Usando Supabase Auth
  // ============================================

  async register(userData: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role: 'customer' | 'provider';
    providerType?: string;
    vehicleModel?: string;
    vehiclePlate?: string;
    documentType?: string;
    documentUrl?: string;
  }) {
    try {
      console.log('📝 Registrando usuário no Supabase Auth...');

      // Validar e limpar email (remover espaços e caracteres invisíveis)
      const cleanEmail = userData.email.trim().toLowerCase().replace(/\s/g, '');
      console.log('📧 Email original:', userData.email);
      console.log('📧 Email limpo:', cleanEmail);

      // Validação mais robusta de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!cleanEmail || !emailRegex.test(cleanEmail)) {
        console.error('❌ Email falhou na validação:', cleanEmail);
        throw new Error('Email inválido. Por favor, verifique o formato.');
      }

      console.log('✅ Email passou na validação, prosseguindo com registro...');

      // Verificar se o email já existe antes de tentar registrar
      console.log('🔍 Verificando se email já existe...');
      try {
        const { data: existingUsers } = await supabase
          .from('profiles')
          .select('email')
          .eq('email', cleanEmail)
          .single();

        if (existingUsers) {
          console.warn('⚠️ Email já existe na tabela profiles');
          throw new Error('Este email já está registrado. Tente fazer login ou use outro email.');
        }
      } catch (checkError: any) {
        // Ignorar erro se a tabela não existir
        if (!checkError.message?.includes('relation "profiles" does not exist')) {
          console.log('ℹ️ Verificação de email existente ignorada (tabela não existe ou erro):', checkError.message);
        }
      }

      // Criar usuário no Supabase Auth
      const redirectUrl = getEmailConfirmationRedirect();
      console.log('🔧 Tentando registrar com email:', cleanEmail);
      console.log('🔧 Redirect URL:', redirectUrl);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            phone: userData.phone,
            role: userData.role,
            providerType: userData.providerType || null,
            vehicleModel: userData.vehicleModel || null,
            vehiclePlate: userData.vehiclePlate || null,
            documentType: userData.documentType || null,
            documentUrl: userData.documentUrl || null,
            is_online: false,
            provider_location: null,
          },
          emailRedirectTo: redirectUrl,
        }
      });

      if (authError) {
        console.error('❌ Erro no registro do Supabase:', authError);
        console.error('❌ Código do erro:', authError.status);
        console.error('❌ Mensagem completa:', authError.message);

        // Verificar se é erro específico de email
        if (authError.message?.includes('invalid') || authError.message?.includes('Invalid')) {
          console.error('🚨 Erro de validação de email detectado');
          throw new Error(translateAuthErrorMessage(authError.message));
        }

        if (
          authError.status === 429 ||
          authError.message?.toLowerCase().includes('email rate limit exceeded')
        ) {
          throw new Error(translateAuthErrorMessage(authError.message));
        }
        throw new Error(this.translateAuthError(authError.message));
      }

      if (!authData.user) {
        throw new Error('Usuário não criado');
      }

      console.log('✅ Usuário criado no Auth:', authData.user.id);

      // Atualizar auth.user com campos adicionais
      try {
        await supabase.auth.updateUser({
          data: {
            is_online: false,
            provider_location: null,
          }
        });
        console.log('✅ Campos is_online e provider_location criados em auth.user');
      } catch (updateError: any) {
        console.warn('⚠️ Erro ao atualizar campos em auth.user:', updateError.message);
      }

      // Salvar perfil no banco de dados
      const profileData = {
        id: authData.user.id,
        email: userData.email,
        name: userData.name,
        phone: userData.phone,
        role: userData.role,
        provider_type: userData.providerType || null,
        vehicle_model: userData.vehicleModel || null,
        vehicle_plate: userData.vehiclePlate || null,
        document_type: userData.documentType || null,
        document_url: userData.documentUrl || null,
        is_online: false,
        location: null,
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([profileData]);

      if (profileError) {
        console.warn('⚠️ Não foi possível salvar no perfil em profiles; o cadastro em auth já foi concluído:', profileError.message);
        // O usuário já foi criado em auth; não bloquear o registro por erro de perfil local
      } else {
        console.log('✅ Perfil salvo em profiles com sucesso');
      }

      const userProfile = {
        id: authData.user.id,
        email: userData.email,
        name: userData.name,
        phone: userData.phone,
        role: userData.role,
        providerType: userData.providerType || null,
        vehicleModel: userData.vehicleModel || null,
        vehiclePlate: userData.vehiclePlate || null,
        documentType: userData.documentType || null,
        documentUrl: userData.documentUrl || null,
        isOnline: false,
      };

      const { error: kvError } = await supabase
        .from('kv_store_9dc5328a')
        .upsert({
          key: `user:${authData.user.id}`,
          value: userProfile,
          is_online: false,
        });

      if (kvError) {
        console.error('❌ Erro ao salvar perfil no KV store:', kvError.message);
        if (!kvError.message.includes('relation "kv_store_9dc5328a" does not exist')) {
          throw new Error(`Erro ao salvar perfil no KV store: ${kvError.message}`);
        }
      }

      console.log('✅ Perfil salvo com sucesso');

      // Não autenticar automaticamente após o cadastro.
      // O fluxo exige confirmação de e-mail no Supabase Auth antes do login.
      this.clearSessionStorage();
      this.setStoredSessionUserId(null);

      return {
        success: true,
        needsConfirmation: true,
        user: {
          id: authData.user.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          providerType: userData.providerType,
          vehicleModel: userData.vehicleModel,
          vehiclePlate: userData.vehiclePlate,
          documentType: userData.documentType,
          documentUrl: userData.documentUrl,
          isOnline: false,
          providerLocation: null,
        },
        accessToken: null,
        message: 'Cadastro realizado com sucesso. Confirme o seu e-mail para ativar a conta.'
      };
    } catch (error: any) {
      console.error('❌ Erro no registro:', error);
      throw error;
    }
  }

  private async upsertUserToKvStore(userId: string, kvValue: any, isOnline: boolean, providerLocation: any) {
    try {
      await this.upsertKvUserRow(userId, kvValue, isOnline, providerLocation || null);
    } catch (error: any) {
      console.warn('⚠️ Não foi possível salvar usuário no KV store:', error.message);
    }
  }

  async saveCurrentUserToKvStore() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        throw new Error(error?.message || 'Usuário não autenticado');
      }

      const kvValue = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || '',
        phone: user.user_metadata?.phone || '',
        role: this.normalizeUserRole(user.user_metadata?.role || user.app_metadata?.role || 'customer'),
        providerType: user.user_metadata?.providerType || user.user_metadata?.provider_type || null,
        vehicleModel: user.user_metadata?.vehicleModel || user.user_metadata?.vehicle_model || null,
        vehiclePlate: user.user_metadata?.vehiclePlate || user.user_metadata?.vehicle_plate || null,
        isOnline: user.user_metadata?.is_online ?? false,
        providerLocation: user.user_metadata?.provider_location || null,
      };

      await this.upsertUserToKvStore(user.id, kvValue, kvValue.isOnline, kvValue.providerLocation);

      return {
        success: true,
        user: kvValue,
      };
    } catch (error: any) {
      console.warn('⚠️ Não foi possível salvar auth.user no KV store:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async login(email: string, password: string, requestedRole?: 'customer' | 'provider' | 'admin' | 'super_admin') {
    try {
      console.log('🔐 Fazendo login no Supabase Auth...');

      // Limpar email (remover espaços e converter para minúsculas)
      const cleanEmail = email.trim().toLowerCase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        console.error('❌ Erro no login:', error.message);
        throw new Error(this.translateAuthError(error.message));
      }

      if (!data.user || !data.session) {
        throw new Error('Login falhou');
      }

      if (!data.user.email_confirmed_at) {
        console.warn('⚠️ Login bloqueado porque o e-mail do Supabase ainda não foi confirmado:', data.user.email);
        throw new Error('Seu e-mail ainda não foi verificado. Verifique o link enviado para a sua conta do Gmail antes de fazer login.');
      }

      console.log('✅ Login realizado:', data.user.id);

      // Garantir que campos existem em auth.user
      try {
        await supabase.auth.updateUser({
          data: {
            is_online: data.user.user_metadata?.is_online ?? false,
            provider_location: data.user.user_metadata?.provider_location || null,
          }
        });
        console.log('✅ Campos is_online e provider_location verificados/criados em auth.user');
      } catch (updateError: any) {
        console.warn('⚠️ Erro ao verificar campos em auth.user:', updateError.message);
      }

      // Buscar perfil do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      const resolvedRole = this.normalizeUserRole(
        profile?.role || data.user.user_metadata?.role || requestedRole || 'customer'
      );

      let userProfile = null;

      if (profileError && !profileError.message.includes('relation "profiles" does not exist')) {
        console.warn('⚠️ Erro ao buscar perfil:', profileError.message);
      } else if (profile) {
        userProfile = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          phone: profile.phone,
          role: this.normalizeUserRole(profile.role || resolvedRole),
          providerType: profile.provider_type,
          vehicleModel: profile.vehicle_model,
          vehiclePlate: profile.vehicle_plate,
          documentType: profile.document_type || null,
          documentUrl: profile.document_url || null,
          isOnline: profile.is_online,
          providerLocation: profile.location,
          location: profile.location,
        };
        console.log('✅ Perfil encontrado em profiles:', profile.id);
      } else {
        // Se não encontrar perfil, criar baseado em auth.user
        console.warn('⚠️ Perfil não encontrado em profiles, criando novo...');
        try {
          const newProfile = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name || '',
            phone: data.user.user_metadata?.phone || '',
            role: resolvedRole,
            provider_type: data.user.user_metadata?.providerType || data.user.user_metadata?.provider_type || null,
            vehicle_model: data.user.user_metadata?.vehicleModel || data.user.user_metadata?.vehicle_model || null,
            vehicle_plate: data.user.user_metadata?.vehiclePlate || data.user.user_metadata?.vehicle_plate || null,
            document_type: data.user.user_metadata?.documentType || null,
            document_url: data.user.user_metadata?.documentUrl || null,
            is_online: false,
            location: null,
          };

          const { data: createdProfile, error: createError } = await supabase
            .from('profiles')
            .insert([newProfile])
            .select()
            .maybeSingle();

          if (createError) {
            console.warn('⚠️ Erro ao criar perfil:', createError.message);
            // Não falhar se a tabela ou colunas não existem
            if (!createError.message.includes('relation "profiles" does not exist') &&
                !createError.message.includes('Could not find') &&
                !createError.message.includes('column')) {
              throw new Error(`Erro ao criar perfil: ${createError.message}`);
            }
          } else if (createdProfile) {
            userProfile = {
              id: createdProfile.id,
              email: createdProfile.email,
              name: createdProfile.name,
              phone: createdProfile.phone,
              role: createdProfile.role,
              providerType: createdProfile.provider_type,
              vehicleModel: createdProfile.vehicle_model,
              vehiclePlate: createdProfile.vehicle_plate,
              documentType: createdProfile.document_type || null,
              documentUrl: createdProfile.document_url || null,
              isOnline: createdProfile.is_online,
              providerLocation: createdProfile.location,
              location: createdProfile.location,
            };
            console.log('✅ Novo perfil criado em profiles:', createdProfile.id);
          }
        } catch (error: any) {
          console.warn('⚠️ Exceção ao criar perfil:', error.message);
        }
      }

      const finalUserProfile = userProfile || {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || '',
        role: resolvedRole,
        providerType: data.user.user_metadata?.providerType || data.user.user_metadata?.provider_type || null,
        vehicleModel: data.user.user_metadata?.vehicleModel || data.user.user_metadata?.vehicle_model || null,
        vehiclePlate: data.user.user_metadata?.vehiclePlate || data.user.user_metadata?.vehicle_plate || null,
        documentType: data.user.user_metadata?.documentType || null,
        documentUrl: data.user.user_metadata?.documentUrl || null,
        isOnline: data.user.user_metadata?.is_online ?? false,
        providerLocation: data.user.user_metadata?.provider_location || null,
      };

      await this.upsertUserToKvStore(
        data.user.id,
        finalUserProfile,
        finalUserProfile.isOnline ?? false,
        finalUserProfile.providerLocation || null
      );

      if (['customer', 'provider'].includes(resolvedRole)) {
        const { error: sessionLogError } = await supabase
          .from('user_login_sessions')
          .insert({ user_id: data.user.id });
        if (sessionLogError) {
          console.warn('Não foi possível registar o início desta sessão. Confirme se a migração de sessões foi aplicada:', sessionLogError.message);
        }
      }

      this.setAccessToken(data.session.access_token);
      this.setStoredSessionUserId(data.user.id);

      return {
        success: true,
        user: finalUserProfile,
        accessToken: data.session.access_token,
        message: 'Login realizado com sucesso!'
      };
    } catch (error: any) {
      console.error('❌ Erro no login:', error);
      throw error;
    }
  }

  async logout() {
    try {
      console.log('🚪 Fazendo logout...');

      // Antes de fazer logout, atualizar status do provider se for um provider
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!userError && user) {
        const userRole = user.user_metadata?.role;
        console.log('👤 Verificando role do usuário para logout:', userRole);

        if (userRole === 'provider') {
          console.log('🔄 Atualizando status do provider para offline...');

          // Buscar dados atuais do provider no kv_store
          const { data: currentData, error: fetchError } = await supabase
            .from('kv_store_9dc5328a')
            .select('value')
            .eq('key', `user:${user.id}`)
            .single();

          if (!fetchError && currentData?.value) {
            const updatedValue = {
              ...currentData.value,
              isOnline: false,
              providerLocation: "",
            };

            // Atualizar kv_store com status offline e localização vazia
            const { error: updateError } = await supabase
              .from('kv_store_9dc5328a')
              .upsert({
                key: `user:${user.id}`,
                value: updatedValue,
                is_online: false,
                provider_location: "",
              });

            if (updateError) {
              console.warn('⚠️ Erro ao atualizar status do provider no logout:', updateError.message);
            } else {
              console.log('✅ Status do provider atualizado para offline no logout');
            }
          }

          // Também atualizar no auth.user metadata
          try {
            await supabase.auth.updateUser({
              data: {
                is_online: false,
                provider_location: "",
              }
            });
            console.log('✅ Metadata do auth.user atualizado para offline');
          } catch (metaError: any) {
            console.warn('⚠️ Erro ao atualizar metadata do auth.user:', metaError.message);
          }
        }
      }

      await logoutOneSignalIdentity();

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ Erro no logout:', error.message);
        throw new Error(error.message);
      }
      this.setAccessToken(null);
      console.log('✅ Logout realizado');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro no logout:', error);
      throw error;
    }
  }

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        console.error('❌ Erro ao buscar usuário atual:', error.message);
        throw new Error(error.message);
      }

      if (!user) {
        return { success: true, user: null };
      }

      // Garantir que campos existem em auth.user
      try {
        await supabase.auth.updateUser({
          data: {
            is_online: user.user_metadata?.is_online ?? false,
            provider_location: user.user_metadata?.provider_location || null,
          }
        });
      } catch (updateError: any) {
        console.warn('⚠️ Erro ao verificar campos em auth.user:', updateError.message);
      }

      const authUser = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || '',
        role: this.normalizeUserRole(user.user_metadata?.role || user.app_metadata?.role || 'customer'),
        providerType: user.user_metadata?.providerType || user.user_metadata?.provider_type || null,
        vehicleModel: user.user_metadata?.vehicleModel || user.user_metadata?.vehicle_model || null,
        vehiclePlate: user.user_metadata?.vehiclePlate || user.user_metadata?.vehicle_plate || null,
        isOnline: user.user_metadata?.is_online ?? false,
        providerLocation: user.user_metadata?.provider_location || null,
      };

      // Buscar perfil do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      let userProfile = null;
      if (profileError && !profileError.message.includes('relation "profiles" does not exist')) {
        console.warn('⚠️ Erro ao buscar perfil:', profileError.message);
      } else if (profile) {
        userProfile = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          phone: profile.phone,
          role: profile.role,
          providerType: profile.provider_type,
          vehicleModel: profile.vehicle_model,
          vehiclePlate: profile.vehicle_plate,
          isOnline: profile.is_online,
          providerLocation: profile.location,
          location: profile.location,
        };
      }

      return {
        success: true,
        user: userProfile || authUser
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar usuário atual:', error);
      throw error;
    }
  }

  async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('❌ Erro ao buscar sessão:', error.message);
        throw new Error(error.message);
      }

      if (!data?.session?.user) {
        return { success: true, user: null };
      }

      const user = data.session.user;
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      // Garantir que campos existem em auth.user
      try {
        await supabase.auth.updateUser({
          data: {
            is_online: user.user_metadata?.is_online ?? false,
            provider_location: user.user_metadata?.provider_location || null,
          }
        });
      } catch (updateError: any) {
        console.warn('⚠️ Erro ao verificar campos em auth.user na sessão:', updateError.message);
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: profile?.name || user.user_metadata?.name || '',
          phone: profile?.phone || user.user_metadata?.phone || '',
          role: this.normalizeUserRole(profile?.role || user.user_metadata?.role || user.app_metadata?.role || 'customer'),
          providerType: profile?.provider_type || user.user_metadata?.providerType || user.user_metadata?.provider_type || null,
          vehicleModel: profile?.vehicle_model || user.user_metadata?.vehicleModel || user.user_metadata?.vehicle_model || null,
          vehiclePlate: profile?.vehicle_plate || user.user_metadata?.vehiclePlate || user.user_metadata?.vehicle_plate || null,
          documentType: profile?.document_type || user.user_metadata?.documentType || null,
          documentUrl: profile?.document_url || user.user_metadata?.documentUrl || null,
          isOnline: profile?.is_online ?? user.user_metadata?.is_online ?? false,
          providerLocation: profile?.location || user.user_metadata?.provider_location || null,
        },
        accessToken: data.session.access_token,
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar sessão:', error);
      throw error;
    }
  }

  // ============================================
  // SERVICE REQUESTS - Acesso direto ao banco
  // ============================================

  async createServiceRequest(requestData: {
    type: string;
    description: string;
    location: { lat: number; lng: number; address: string };
    estimatedPrice: number;
    mechanicName?: string;
    providerId?: string;
    providerLocation?: { lat: number; lng: number };
  }) {
    try {
      console.log('📡 Criando solicitação de serviço...');

      // Verificar se usuário está autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Usuário não autenticado');
      }

      const serviceData = {
        id: `request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        customer_id: user.id,
        customer_phone: user.user_metadata?.phone || user.phone || '',
        provider_id: requestData.providerId || null,
        type: requestData.type,
        description: requestData.description,
        location: requestData.location,
        provider_location: requestData.providerLocation || null,
        estimated_price: requestData.estimatedPrice,
        mechanic_name: requestData.mechanicName || null,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('service_requests')
        .insert([serviceData])
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar solicitação:', error.message);
        throw new Error(`Erro ao criar solicitação: ${error.message}`);
      }

      console.log('✅ Solicitação criada:', data.id);

      try {
        await supabase
          .from('kv_store_9dc5328a')
          .upsert({
            key: `service:${serviceData.id}`,
            value: serviceData,
            is_online: false,
          });
      } catch (kvError: any) {
        console.warn('⚠️ Não foi possível salvar solicitação no KV store:', kvError.message);
      }

      return {
        success: true,
        request: {
          id: data.id,
          customerId: data.customer_id,
          providerId: data.provider_id,
          mechanicName: data.mechanic_name,
          type: data.type,
          description: data.description,
          location: data.location,
          providerLocation: data.provider_location,
          estimatedPrice: data.estimated_price,
          paymentReference: data.payment_reference,
          paymentAmount: data.payment_amount,
          paymentMethod: data.payment_method,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
        message: 'Solicitação criada com sucesso!'
      };
    } catch (error: any) {
      console.error('❌ Erro ao criar solicitação:', error);
      throw error;
    }
  }

  async getServiceRequest(requestId: string) {
    try {
      console.log('📡 Buscando solicitação:', requestId);

      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao buscar solicitação:', error.message);
        throw new Error(`Erro ao buscar solicitação: ${error.message}`);
      }

      if (!data) {
        throw new Error('Solicitação não encontrada');
      }

      return {
        success: true,
        request: {
          id: data.id,
          customerId: data.customer_id,
          providerId: data.provider_id,
          mechanicName: data.mechanic_name,
          type: data.type,
          description: data.description,
          location: data.location,
          providerLocation: data.provider_location,
          estimatedPrice: data.estimated_price,
          paymentReference: data.payment_reference,
          paymentAmount: data.payment_amount,
          paymentMethod: data.payment_method,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar solicitação:', error);
      throw error;
    }
  }

  private async getCurrentAdminVisibilityScope() {
    try {
      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser?.user) {
        return { allowAll: false, ids: new Set<string>(), currentUserId: null, isAdmin: false };
      }

      const currentUserId = authUser.user.id;
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, supervision_admin_id')
        .eq('id', currentUserId)
        .maybeSingle();

      if (profileError && !this.isMissingTableError(profileError)) {
        console.warn('⚠️ Não foi possível carregar o perfil atual para supervisão:', profileError.message);
      }

      const currentRole = this.normalizeUserRole(currentProfile?.role || authUser.user.user_metadata?.role || authUser.user.app_metadata?.role || 'customer');
      if (currentRole === 'super_admin') {
        return { allowAll: true, ids: new Set<string>(), currentUserId, isAdmin: true };
      }

      if (currentRole !== 'admin') {
        return { allowAll: false, ids: new Set<string>(), currentUserId, isAdmin: false };
      }

      const { data: profilesRows, error: profilesError } = await supabase
        .from('profiles')
        .select('id, supervision_admin_id')
        .in('role', ['customer', 'provider', 'mechanic']);

      if (profilesError && !this.isMissingTableError(profilesError)) {
        console.warn('⚠️ Não foi possível carregar a lista de supervisão:', profilesError.message);
        return { allowAll: false, ids: new Set<string>(), currentUserId, isAdmin: true };
      }

      const ids = new Set<string>();
      for (const row of profilesRows || []) {
        const targetId = row.id;
        if (!row.supervision_admin_id || String(row.supervision_admin_id) === currentUserId) {
          ids.add(targetId);
        }
      }

      return { allowAll: false, ids, currentUserId, isAdmin: true };
    } catch (error: any) {
      console.warn('⚠️ Falha ao montar escopo de supervisão do admin:', error?.message || error);
      return { allowAll: false, ids: new Set<string>(), currentUserId: null, isAdmin: false };
    }
  }

  async logSupervisionHistory({ userId, previousAdminId, nextAdminId, assignedBy, action, note }: {
    userId: string;
    previousAdminId?: string | null;
    nextAdminId?: string | null;
    assignedBy?: string | null;
    action: 'assigned' | 'transferred' | 'removed';
    note?: string;
  }) {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      const actorId = assignedBy || authUser?.user?.id || null;
      const payload = {
        user_id: userId,
        previous_admin_id: previousAdminId || null,
        next_admin_id: nextAdminId || null,
        assigned_by: actorId,
        action,
        note: note || null,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('user_supervision_assignments').insert(payload);
      if (error && !this.isMissingTableError(error)) {
        console.warn('⚠️ Não foi possível guardar o histórico de supervisão:', error.message);
      }
      return { success: true };
    } catch (error: any) {
      console.warn('⚠️ Falha ao registrar histórico de supervisão:', error?.message || error);
      return { success: false };
    }
  }

  async getSupervisionHistory() {
    try {
      const { data, error } = await supabase
        .from('user_supervision_assignments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && !this.isMissingTableError(error)) {
        throw new Error(error.message);
      }

      const rows = (data || []).map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        previous_admin_id: item.previous_admin_id,
        next_admin_id: item.next_admin_id,
        assigned_by: item.assigned_by,
        action: item.action,
        note: item.note,
        created_at: item.created_at,
      }));

      return { success: true, history: rows };
    } catch (error: any) {
      return { success: true, history: [] };
    }
  }

  async getUserById(userId: string) {
    try {
      console.log('🔍 Buscando usuário por ID no KV:', userId);

      const { data, error } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value, is_online, provider_location')
        .eq('key', `user:${userId}`)
        .maybeSingle();

      if (error && !this.isMissingTableError(error)) {
        console.warn('⚠️ Falha ao buscar usuário por ID no KV:', error.message);
      }

      const kvValue = data?.value && typeof data.value === 'object' ? data.value : {};
      const user = {
        id: kvValue.id || userId,
        email: kvValue.email || '',
        name: kvValue.name || kvValue.full_name || 'Prestador',
        phone: kvValue.phone || '',
        role: String(kvValue.role || 'provider').toLowerCase(),
        providerType: kvValue.providerType || kvValue.provider_type || '',
        vehicleModel: kvValue.vehicleModel || kvValue.vehicle_model || '',
        vehiclePlate: kvValue.vehiclePlate || kvValue.vehicle_plate || '',
        documentType: kvValue.documentType || kvValue.document_type || '',
        documentUrl: kvValue.documentUrl || kvValue.document_url || '',
        avatar: kvValue.avatar || null,
        location: data?.provider_location ?? kvValue.providerLocation ?? kvValue.provider_location ?? kvValue.location ?? null,
        isOnline: Boolean(data?.is_online ?? kvValue.isOnline ?? kvValue.is_online ?? false),
      };

      return {
        success: true,
        user,
      };
    } catch (error: any) {
      console.warn('⚠️ Erro ao buscar usuário por ID no KV:', error?.message || error);
      return {
        success: true,
        user: {
          id: userId,
          email: '',
          name: 'Prestador',
          phone: '',
          role: 'provider',
          providerType: '',
          vehicleModel: '',
          vehiclePlate: '',
          avatar: null,
          location: null,
        }
      };
    }
  }

  async isEmailRegistered(email: string): Promise<boolean> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error('Email inválido. Verifique o formato antes de continuar.');
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (this.isMissingTableError(error)) return false;
      throw new Error(`Não foi possível verificar o e-mail: ${error.message}`);
    }
    return Boolean(data);
  }

  async updateProfile(data: {
    name?: string;
    phone?: string;
    vehicleModel?: string;
    vehiclePlate?: string;
    documentType?: string;
    documentUrl?: string;
  }) {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const authUser = authData.user;
      if (authError || !authUser) throw new Error('É necessário iniciar sessão para atualizar o perfil.');

      const updates: Record<string, string> = {};
      if (data.name !== undefined) updates.name = String(data.name).trim();
      if (data.phone !== undefined) updates.phone = String(data.phone).trim();
      if (data.vehicleModel !== undefined) updates.vehicle_model = String(data.vehicleModel).trim();
      if (data.vehiclePlate !== undefined) updates.vehicle_plate = String(data.vehiclePlate).trim();
      if (data.documentType !== undefined) updates.document_type = String(data.documentType).trim();
      if (data.documentUrl !== undefined) updates.document_url = String(data.documentUrl).trim();

      if (!Object.keys(updates).length) {
        throw new Error('Não há dados de perfil para atualizar.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', authUser.id)
        .select('*')
        .maybeSingle();

      if (profileError) throw new Error(profileError.message);
      if (!profile) throw new Error('O perfil não foi encontrado ou não pode ser atualizado.');

      const normalizedRole = this.normalizeUserRole(profile.role);
      let role: 'customer' | 'provider' | 'admin' | 'super_admin' = 'customer';
      if (normalizedRole === 'provider' || normalizedRole === 'admin' || normalizedRole === 'super_admin') {
        role = normalizedRole;
      }

      const user = {
        id: profile.id,
        email: profile.email || authUser.email || '',
        name: profile.name || '',
        phone: profile.phone || '',
        role,
        providerType: profile.provider_type || '',
        vehicleModel: profile.vehicle_model || '',
        vehiclePlate: profile.vehicle_plate || '',
        documentType: profile.document_type || '',
        documentUrl: profile.document_url || '',
        isOnline: Boolean(profile.is_online),
        providerLocation: profile.location || null,
      };
      await this.upsertKvUserRow(authUser.id, user, user.isOnline, user.providerLocation);
      return { success: true, user };
    } catch (error: any) {
      console.error('Erro ao atualizar o perfil:', error);
      return { success: false, error: error?.message || 'Não foi possível atualizar o perfil.' };
    }
  }

  async saveProviderDocument(
    userId: string,
    document: { documentType: string; documentUrl: string },
  ) {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user || authData.user.id !== userId) {
        throw new Error('Só pode atualizar os documentos da sua própria conta.');
      }

      const documentType = String(document.documentType || '').trim();
      const documentUrl = String(document.documentUrl || '').trim();
      if (!documentType || !documentUrl) {
        throw new Error('O tipo e o ficheiro do documento são obrigatórios.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .update({
          document_type: documentType,
          document_url: documentUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('id')
        .maybeSingle();
      if (profileError) throw new Error(profileError.message);
      if (!profile) throw new Error('Não foi encontrado o perfil do prestador.');

      const { data: kvRow, error: kvReadError } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value, is_online, provider_location')
        .eq('key', `user:${userId}`)
        .maybeSingle();
      if (kvReadError && !this.isMissingTableError(kvReadError)) throw new Error(kvReadError.message);
      const existingValue = kvRow?.value && typeof kvRow.value === 'object' ? kvRow.value : {};
      const { error: kvWriteError } = await supabase
        .from('kv_store_9dc5328a')
        .upsert({
          key: `user:${userId}`,
          value: {
            ...existingValue,
            documentType,
            document_type: documentType,
            documentUrl,
            document_url: documentUrl,
            document_removed_at: null,
            updated_at: new Date().toISOString(),
          },
          is_online: Boolean(kvRow?.is_online),
          provider_location: kvRow?.provider_location ?? null,
        });
      if (kvWriteError && !this.isMissingTableError(kvWriteError)) throw new Error(kvWriteError.message);

      return { success: true };
    } catch (error: any) {
      console.error('Erro ao guardar o documento do prestador:', error);
      return { success: false, error: error?.message || 'Não foi possível guardar o documento.' };
    }
  }

  async deleteProviderDocument(userId: string) {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user || authData.user.id !== userId) {
        throw new Error('Só pode eliminar os documentos da sua própria conta.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .update({
          document_type: null,
          document_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('id')
        .maybeSingle();
      if (profileError) throw new Error(profileError.message);
      if (!profile) throw new Error('Não foi encontrado o perfil do prestador.');

      const { data: kvRow, error: kvReadError } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value, is_online, provider_location')
        .eq('key', `user:${userId}`)
        .maybeSingle();
      if (kvReadError && !this.isMissingTableError(kvReadError)) throw new Error(kvReadError.message);
      const existingValue = kvRow?.value && typeof kvRow.value === 'object' ? kvRow.value : {};
      const removedAt = new Date().toISOString();
      const { error: kvWriteError } = await supabase
        .from('kv_store_9dc5328a')
        .upsert({
          key: `user:${userId}`,
          value: {
            ...existingValue,
            documentType: null,
            document_type: null,
            documentUrl: null,
            document_url: null,
            document_removed_at: removedAt,
            updated_at: removedAt,
          },
          is_online: Boolean(kvRow?.is_online),
          provider_location: kvRow?.provider_location ?? null,
        });
      if (kvWriteError && !this.isMissingTableError(kvWriteError)) throw new Error(kvWriteError.message);

      return { success: true };
    } catch (error: any) {
      console.error('Erro ao eliminar o documento do prestador:', error);
      return { success: false, error: error?.message || 'Não foi possível eliminar o documento.' };
    }
  }

  async updateServiceRequest(requestId: string, updates: any) {
    try {
      console.log('📝 Atualizando solicitação:', requestId, updates);

      if (['completed', 'finalized', 'finalizado'].includes(String(updates.status || '').toLowerCase())) {
        throw new Error('A conclusão da solicitação deve ser registada através da confirmação do cliente.');
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.status) updateData.status = updates.status;
      if (updates.providerId !== undefined) updateData.provider_id = updates.providerId;
      if (updates.estimatedPrice !== undefined) updateData.estimated_price = updates.estimatedPrice;
      if (updates.providerLocation !== undefined) updateData.provider_location = updates.providerLocation;
      if (updates.paymentReference !== undefined) updateData.payment_reference = updates.paymentReference;
      if (updates.paymentAmount !== undefined) updateData.payment_amount = updates.paymentAmount;
      if (updates.paymentMethod !== undefined) updateData.payment_method = updates.paymentMethod;
      if (updates.isBlocked !== undefined) updateData.is_blocked = updates.isBlocked;
      if (updates.blockedBy !== undefined) updateData.blocked_by = updates.blockedBy;
      if (updates.blockedReason !== undefined) updateData.blocked_reason = updates.blockedReason;
      if (updates.blockedAt !== undefined) updateData.blocked_at = updates.blockedAt;

      const { data, error } = await supabase
        .from('service_requests')
        .update(updateData)
        .eq('id', requestId)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao atualizar solicitação:', error.message);
        throw new Error(`Erro ao atualizar solicitação: ${error.message}`);
      }

      console.log('✅ Solicitação atualizada:', data.id);

      return {
        success: true,
        request: {
          id: data.id,
          customerId: data.customer_id,
          providerId: data.provider_id,
          mechanicName: data.mechanic_name,
          type: data.type,
          description: data.description,
          location: data.location,
          providerLocation: data.provider_location,
          estimatedPrice: data.estimated_price,
          paymentReference: data.payment_reference,
          paymentAmount: data.payment_amount,
          paymentMethod: data.payment_method,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }
      };
    } catch (error: any) {
      console.error('❌ Erro ao atualizar solicitação:', error);
      throw error;
    }
  }

  async createNotification(notificationData: {
    userId: string;
    requestId?: string;
    type: string;
    title: string;
    message: string;
    payload?: Record<string, any>;
    status?: string;
  }) {
    try {
      const notification = {
        id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        user_id: notificationData.userId,
        request_id: notificationData.requestId || null,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        payload: notificationData.payload || null,
        status: notificationData.status || 'unread',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('notifications')
        .insert([notification])
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar notificação:', error.message);
        throw new Error(error.message);
      }

      return { success: true, notification: data };
    } catch (error: any) {
      console.error('❌ Erro ao criar notificação:', error);
      throw error;
    }
  }

  async notifyAdminsProviderArrival(details: {
    id: string;
    providerId: string;
    providerName: string;
    customerName?: string;
    distanceMeters: number;
    stage: 'nearby' | 'arrived';
  }) {
    try {
      const { data: admins, error: adminsError } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'super_admin']);
      if (adminsError) throw new Error(adminsError.message);

      const adminIds = [...new Set((admins || []).map((admin: { id: string }) => String(admin.id)).filter(Boolean))];
      if (adminIds.length === 0) {
        throw new Error('Não existem administradores para receber a notificação.');
      }

      const arrived = details.stage === 'arrived';
      const now = new Date().toISOString();
      const notifications = adminIds.map((adminId) => ({
        id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        user_id: adminId,
        request_id: details.id,
        type: arrived ? 'provider_arrived_near_customer' : 'provider_near_customer',
        title: arrived ? 'Mecânico chegou ao local' : 'Mecânico próximo do cliente',
        message: arrived
          ? `${details.providerName} chegou ao local${details.customerName ? ` do cliente ${details.customerName}` : ''}.`
          : `${details.providerName} está a cerca de ${Math.round(details.distanceMeters)} m${details.customerName ? ` do cliente ${details.customerName}` : ''}.`,
        payload: {
          requestId: details.id,
          providerId: details.providerId,
          providerName: details.providerName,
          customerName: details.customerName || null,
          distanceMeters: Math.round(details.distanceMeters),
          stage: details.stage,
        },
        status: 'unread',
        created_at: now,
        updated_at: now,
      }));

      const { error: insertError } = await supabase.from('notifications').insert(notifications);
      if (insertError) throw new Error(insertError.message);
      return { success: true, notifiedCount: notifications.length };
    } catch (error: any) {
      console.error('Erro ao notificar administradores sobre a chegada do mecânico:', error);
      return {
        success: false,
        error: error?.message || 'Não foi possível notificar os administradores.',
        notifiedCount: 0,
      };
    }
  }

  async getUserNotifications(userId: string) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar notificações do usuário:', error.message);
        throw new Error(error.message);
      }

      return { success: true, notifications: data || [] };
    } catch (error: any) {
      console.error('❌ Erro ao buscar notificações:', error);
      throw error;
    }
  }

  async markNotificationAsRead(notificationId: string) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ status: 'read', updated_at: new Date().toISOString() })
        .eq('id', notificationId)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao marcar notificação como lida:', error.message);
        throw new Error(error.message);
      }

      return { success: true, notification: data };
    } catch (error: any) {
      console.error('❌ Erro ao marcar notificação como lida:', error);
      throw error;
    }
  }

  async markAllNotificationsAsReadForUser(userId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('status', 'unread');

      if (error) {
        console.error('❌ Erro ao marcar todas as notificações como lidas:', error.message);
        throw new Error(error.message);
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao marcar todas as notificações como lidas:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId: string) {
    try {
      if (!notificationId) {
        throw new Error('ID da notificação não informado.');
      }

      const { error: tableError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (tableError && !this.isMissingTableError(tableError)) {
        throw new Error(tableError.message);
      }

      const kvDelete = await supabase
        .from('kv_store_9dc5328a')
        .delete()
        .eq('key', `notification:${notificationId}`);

      if (kvDelete.error && !this.isMissingTableError(kvDelete.error)) {
        console.warn('⚠️ Não foi possível remover notificação do KV:', kvDelete.error.message);
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao apagar notificação:', error);
      throw error;
    }
  }

  async deleteAllNotificationsForUser(userId: string) {
    try {
      const { error: tableError } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);

      if (tableError && !this.isMissingTableError(tableError)) {
        throw new Error(tableError.message);
      }

      const { data: kvRows, error: kvFetchError } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value')
        .like('key', 'notification:%');

      if (kvFetchError && !this.isMissingTableError(kvFetchError)) {
        throw new Error(kvFetchError.message);
      }

      const deletePromises = (kvRows || [])
        .filter((row: any) => {
          const value = row.value && typeof row.value === 'object' ? row.value : null;
          return value && String(value.user_id || value.userId || '') === String(userId);
        })
        .map((row: any) => supabase.from('kv_store_9dc5328a').delete().eq('key', row.key));

      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao apagar todas as notificações:', error);
      throw error;
    }
  }

  async notifyOnlineProvidersOfNewRequest(requestData: {
    id: string;
    type: string;
    description: string;
    location: { lat: number; lng: number; address: string };
    customerId: string;
    customerName: string;
    estimatedPrice: number;
  }) {
    try {
      const { data: providers, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'provider')
        .eq('is_online', true);

      if (error) {
        console.error('❌ Erro ao buscar prestadores online:', error.message);
        throw new Error(error.message);
      }

      if (!providers || providers.length === 0) {
        return { success: true, count: 0 };
      }

      const notifications = providers.map((provider: any) => ({
        id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        user_id: provider.id,
        request_id: requestData.id,
        type: 'new_service_request',
        title: 'Nova solicitação de serviço recebida',
        message: `Cliente ${requestData.customerName} pediu ${requestData.type} em ${requestData.location.address}.`,
        payload: {
          requestId: requestData.id,
          customerName: requestData.customerName,
          location: requestData.location,
          serviceType: requestData.type,
          estimatedPrice: requestData.estimatedPrice,
        },
        status: 'unread',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data: inserted, error: insertError } = await supabase
        .from('notifications')
        .insert(notifications)
        .select();

      if (insertError) {
        console.error('❌ Erro ao criar notificações para prestadores online:', insertError.message);
        throw new Error(insertError.message);
      }

      return { success: true, count: inserted.length };
    } catch (error: any) {
      console.error('❌ Erro ao notificar prestadores online:', error);
      throw error;
    }
  }

  private isMissingTableError(error: any) {
    return (
      error?.code === '42P01' ||
      error?.message?.toLowerCase().includes('does not exist') ||
      error?.message?.toLowerCase().includes('relation') ||
      error?.message?.toLowerCase().includes('no table')
    );
  }

  private isMissingColumnError(error: any) {
    return (
      error?.code === '42703' ||
      (error?.message?.toLowerCase().includes('column') && error?.message?.toLowerCase().includes('does not exist')) ||
      error?.message?.toLowerCase().includes('unknown column') ||
      (error?.message?.toLowerCase().includes('attribute') && error?.message?.toLowerCase().includes('does not exist'))
    );
  }

  private isPermissionError(error: any) {
    return (
      error?.code === '42501' ||
      error?.message?.toLowerCase().includes('permission denied') ||
      error?.message?.toLowerCase().includes('row-level security') ||
      error?.message?.toLowerCase().includes('policy') ||
      error?.message?.toLowerCase().includes('insufficient privilege')
    );
  }

  private async upsertKvUserRow(userId: string, value: any, isOnline: boolean, providerLocation: any): Promise<boolean> {
    const { data: existingRow, error: existingError } = await supabase
      .from('kv_store_9dc5328a')
      .select('key, value, is_online, provider_location')
      .eq('key', `user:${userId}`)
      .maybeSingle();
    if (existingError && !this.isMissingTableError(existingError)) {
      throw new Error(existingError.message);
    }

    const existingValue = existingRow?.value && typeof existingRow.value === 'object' ? existingRow.value : {};
    const cleanIncomingValue = value && typeof value === 'object' ? value : {};

    const preservedValue = {
      ...existingValue,
      ...cleanIncomingValue,
      id: cleanIncomingValue.id ?? existingValue.id ?? userId,
      updated_at: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const blockedState = this.isProviderBlockedForAvailability({ value: preservedValue });

    if (blockedState) {
      preservedValue.status = this.isProviderManuallyBlocked({ value: preservedValue }) ? 'blocked' : 'offline';
      preservedValue.isOnline = false;
      preservedValue.is_online = false;
      preservedValue.providerLocation = null;
      preservedValue.provider_location = null;
      preservedValue.location = null;
    } else if (typeof isOnline === 'boolean') {
      preservedValue.isOnline = isOnline;
      preservedValue.is_online = isOnline;
      preservedValue.status = String(preservedValue.status || '').toLowerCase() === 'blocked'
        ? (isOnline ? 'available' : 'offline')
        : preservedValue.status || (isOnline ? 'available' : 'offline');
      if (!isOnline) {
        preservedValue.providerLocation = null;
        preservedValue.provider_location = null;
        preservedValue.location = null;
      }
    }

    const row = {
      key: `user:${userId}`,
      value: preservedValue,
      is_online: blockedState ? false : typeof isOnline === 'boolean' ? isOnline : Boolean(existingRow?.is_online ?? preservedValue.isOnline ?? false),
      provider_location: blockedState || isOnline === false
        ? null
        : providerLocation ?? existingRow?.provider_location ?? preservedValue.providerLocation ?? preservedValue.provider_location ?? preservedValue.location ?? null,
    };

    const { error } = await supabase
      .from('kv_store_9dc5328a')
      .upsert(row);

    if (error && this.isMissingColumnError(error)) {
      const { error: fallbackError } = await supabase
        .from('kv_store_9dc5328a')
        .upsert({ key: `user:${userId}`, value: preservedValue });

      if (fallbackError && !this.isMissingTableError(fallbackError)) {
        throw new Error(fallbackError.message);
      }

      return blockedState;
    }

    if (error && !this.isMissingTableError(error)) {
      throw new Error(error.message);
    }
    return blockedState;
  }

  async deleteServiceRequest(requestId: string) {
    try {
      console.log('🗑️ Excluindo solicitação:', requestId);

      const { error } = await supabase
        .from('service_requests')
        .delete()
        .eq('id', requestId);

      if (error && !this.isMissingTableError(error)) {
        console.error('❌ Erro ao excluir solicitação:', error.message);
        throw new Error(`Erro ao excluir solicitação: ${error.message}`);
      }

      try {
        const { error: kvError } = await supabase
          .from('kv_store_9dc5328a')
          .delete()
          .eq('key', `service:${requestId}`);

        if (kvError) {
          console.warn('⚠️ Erro ao remover entrada do KV store:', kvError.message);
        }
      } catch (kvError: any) {
        console.warn('⚠️ Erro ao limpar KV store:', kvError.message);
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao excluir solicitação:', error);
      throw error;
    }
  }

  async finalizeServiceRequest(requestId: string, finalPrice?: number) {
    try {
      console.log('✔️ Finalizando solicitação:', requestId, finalPrice ? `com preço final: ${finalPrice}` : '');

      let serviceRequest: any = null;

      const { data: dbRequest, error: selectError } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (!selectError && dbRequest) {
        serviceRequest = dbRequest;
      } else if (selectError && !this.isMissingTableError(selectError)) {
        console.error('❌ Erro ao buscar solicitação para finalização:', selectError.message);
        throw new Error(`Erro ao buscar solicitação: ${selectError.message}`);
      }

      if (!serviceRequest) {
        const { data: kvData, error: kvError } = await supabase
          .from('kv_store_9dc5328a')
          .select('value')
          .eq('key', `service:${requestId}`)
          .maybeSingle();

        if (kvError) {
          console.error('❌ Erro ao buscar solicitação no KV store:', kvError.message);
          throw new Error(`Erro ao buscar solicitação no KV store: ${kvError.message}`);
        }

        serviceRequest = kvData?.value;
      }

      if (!serviceRequest) {
        throw new Error('Solicitação não encontrada para finalização');
      }

      const currentStatus = String(serviceRequest.status || '').toLowerCase();
      if (currentStatus !== 'awaiting_customer_confirmation') {
        throw new Error('A solicitação só pode ser concluída depois de o mecânico pedir a confirmação do cliente.');
      }

      const finalizadoRow: any = {
        id: serviceRequest.id,
        customer_id: serviceRequest.customer_id ?? serviceRequest.customerId,
        provider_id: serviceRequest.provider_id ?? serviceRequest.providerId,
        mechanic_name: serviceRequest.mechanic_name ?? serviceRequest.mechanicName,
        type: serviceRequest.type,
        description: serviceRequest.description,
        location: serviceRequest.location,
        provider_location: serviceRequest.provider_location ?? serviceRequest.providerLocation ?? null,
        estimated_price: serviceRequest.estimated_price ?? serviceRequest.estimatedPrice ?? null,
        final_price: finalPrice ?? serviceRequest.estimated_price ?? serviceRequest.estimatedPrice ?? null,
        status: 'completed',
        created_at: serviceRequest.created_at ?? serviceRequest.createdAt,
        updated_at: serviceRequest.updated_at ?? serviceRequest.updatedAt ?? new Date().toISOString(),
        finalized_at: new Date().toISOString(),
      };

      if (finalPrice !== undefined) {
        console.log('💵 Preço final salvo:', finalPrice);
      }

      const { error: insertError } = await supabase
        .from('finalizado')
        .insert([finalizadoRow]);

      if (insertError && !this.isMissingTableError(insertError)) {
        console.error('❌ Erro ao inserir finalizado:', insertError.message);
        throw new Error(`Erro ao salvar finalizado: ${insertError.message}`);
      }

      const providerId = serviceRequest.provider_id ?? serviceRequest.providerId;
      const finalizedAmount = Number(finalPrice ?? serviceRequest.final_price ?? serviceRequest.finalPrice ?? serviceRequest.estimated_price ?? serviceRequest.estimatedPrice ?? 0) || 0;
      const mechanicDebtIncrement = calculatePlatformCommission(finalizedAmount);

      if (providerId && mechanicDebtIncrement > 0) {
        const currentDebtResult = await this.getProviderDebt(providerId);
        if (!currentDebtResult.success) {
          throw new Error(currentDebtResult.error || 'Não foi possível consultar a dívida atual do mecânico.');
        }
        const currentDebt = Number(currentDebtResult?.debt ?? 0) || 0;
        const nextDebt = currentDebt + mechanicDebtIncrement;
        const dueDate = currentDebtResult?.debtDueDate ?? new Date().toISOString();
        const debtResult = await this.syncProviderDebt(providerId, nextDebt, dueDate);

        if (!debtResult.success) {
          throw new Error(debtResult.error || 'Não foi possível registar a dívida do mecânico.');
        }
      }

      const { error: deleteError } = await supabase
        .from('service_requests')
        .delete()
        .eq('id', requestId);

      if (deleteError && !this.isMissingTableError(deleteError)) {
        console.error('❌ Erro ao excluir solicitação após finalização:', deleteError.message);
        throw new Error(`Erro ao excluir solicitação: ${deleteError.message}`);
      }

      try {
        const { error: kvDeleteError } = await supabase
          .from('kv_store_9dc5328a')
          .delete()
          .eq('key', `service:${requestId}`);

        if (kvDeleteError) {
          console.warn('⚠️ Erro ao remover solicitação do KV store:', kvDeleteError.message);
        }
      } catch (kvDeleteError: any) {
        console.warn('⚠️ Erro ao remover solicitação do KV store:', kvDeleteError.message);
      }

      return { success: true, request: finalizadoRow };
    } catch (error: any) {
      console.error('❌ Erro ao finalizar solicitação:', error);
      throw error;
    }
  }

  async getPendingServices() {
    try {
      console.log('📋 Buscando solicitações pendentes...');

      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar solicitações pendentes:', error.message);
        throw new Error(`Erro ao buscar solicitações pendentes: ${error.message}`);
      }

      const requests = data.map(item => ({
        id: item.id,
        customerId: item.customer_id,
        providerId: item.provider_id,
        mechanicName: item.mechanic_name,
        type: item.type,
        description: item.description,
        location: item.location,
        estimatedPrice: item.estimated_price,
        paymentReference: item.payment_reference,
        paymentAmount: item.payment_amount,
        paymentMethod: item.payment_method,
        status: item.status,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));

      console.log(`✅ ${requests.length} solicitações pendentes encontradas`);

      return {
        success: true,
        requests: requests,
        message: `${requests.length} solicitações disponíveis`
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar solicitações pendentes:', error);
      throw error;
    }
  }

  async getUserServices(userId: string) {
    try {
      console.log('📋 Buscando serviços do usuário:', userId);

      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .or(`customer_id.eq.${userId},provider_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar serviços do usuário:', error.message);
        throw new Error(`Erro ao buscar serviços do usuário: ${error.message}`);
      }

      const requests = data.map(item => ({
        id: item.id,
        customerId: item.customer_id,
        customerPhone: item.customer_phone,
        providerId: item.provider_id,
        mechanicName: item.mechanic_name,
        type: item.type,
        description: item.description,
        location: item.location,
        estimatedPrice: item.estimated_price,
        paymentReference: item.payment_reference,
        paymentAmount: item.payment_amount,
        paymentMethod: item.payment_method,
        status: item.status,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));

      console.log(`✅ ${requests.length} serviços encontrados para o usuário`);

      return {
        success: true,
        requests: requests,
        message: `${requests.length} serviços encontrados`
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar serviços do usuário:', error);
      throw error;
    }
  }

  // ============================================
  // PROVIDER METHODS - Acesso direto ao banco
  // ============================================

  async updateProviderStatus(isOnline: boolean, location?: any) {
    try {
      console.log('🟢 Atualizando status do prestador...');

      // Verificar se usuário está autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Usuário não autenticado');
      }

      let profileData: any = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || '',
        phone: user.user_metadata?.phone || '',
        role: user.user_metadata?.role || 'provider',
        provider_type: user.user_metadata?.providerType || user.user_metadata?.provider_type || null,
        vehicle_model: user.user_metadata?.vehicleModel || user.user_metadata?.vehicle_model || null,
        vehicle_plate: user.user_metadata?.vehiclePlate || user.user_metadata?.vehicle_plate || null,
        is_online: user.user_metadata?.is_online ?? isOnline,
        location: user.user_metadata?.provider_location || location || null,
      };

      // O estado ativo do prestador deve ser persistido no KV store.
      // A tabela profiles não está autorizada para este update em produção.

      const kvValue = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        phone: profileData.phone,
        role: profileData.role,
        providerType: profileData.provider_type,
        vehicleModel: profileData.vehicle_model,
        vehiclePlate: profileData.vehicle_plate,
        isOnline,
        is_online: isOnline,
        providerLocation: isOnline ? location || profileData.location || null : null,
        provider_location: isOnline ? location || profileData.location || null : null,
        location: isOnline ? location || profileData.location || null : null,
      };

      const blocked = await this.upsertKvUserRow(user.id, kvValue, isOnline, isOnline ? location || null : null);
      if (isOnline && blocked) {
        await supabase.auth.updateUser({
          data: { is_online: false, provider_location: null }
        });
        throw new Error('A conta está bloqueada ou suspensa por dívida. Regularize a situação e aguarde a confirmação do administrador.');
      }

      const authUpdate = await supabase.auth.updateUser({
        data: {
          is_online: isOnline,
          provider_location: isOnline ? location || null : null,
        }
      });

      if (authUpdate.error) {
        console.warn('⚠️ Não foi possível atualizar auth.user:', authUpdate.error.message);
      }

      console.log(`✅ Status atualizado: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      return {
        success: true,
        user: {
          id: profileData.id,
          email: profileData.email,
          name: profileData.name,
          phone: profileData.phone,
          role: profileData.role,
          providerType: profileData.provider_type,
          vehicleModel: profileData.vehicle_model,
          vehiclePlate: profileData.vehicle_plate,
          isOnline: isOnline,
          providerLocation: location || profileData.location || null,
          location: profileData.location || null,
        },
        message: 'Status atualizado com sucesso'
      };
    } catch (error: any) {
      console.error('❌ Erro ao atualizar status do prestador:', error);
      throw error;
    }
  }

  async getNearbyProviders(location: any, _serviceType?: string) {
    try {
      console.log('🔍 Buscando prestadores online via KV store...');

      const { data, error } = await supabase
        .from('kv_store_9dc5328a')
        .select('key,value,is_online,provider_location')
        .eq('is_online', true)
        .contains('value', { role: 'provider' });

      if (error) {
        console.warn('⚠️ Falha ao buscar providers no KV store, retornando providers da tabela profiles:', error.message);

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'provider')
          .eq('is_online', true);

        if (profileError) {
          console.error('❌ Erro ao buscar prestadores:', profileError.message);
          throw new Error(`Erro ao buscar prestadores: ${profileError.message}`);
        }

        const providers = (profileData || [])
          .map((provider: any) => {
            const status = String(provider.status || (provider.is_online ? 'available' : 'offline')).toLowerCase();
            const isBlocked = this.isProviderBlockedForAvailability(provider);

            return {
              id: provider.id,
              name: provider.name,
              providerType: provider.provider_type,
              vehicleModel: provider.vehicle_model,
              vehiclePlate: provider.vehicle_plate,
              location: provider.location,
              isOnline: isBlocked ? false : provider.is_online,
              status: isBlocked ? 'blocked' : status,
              isBlocked,
            };
          })
          .filter((provider: any) => !Boolean(provider.isBlocked));

        console.log(`✅ ${providers.length} prestadores encontrados na tabela profiles`);
        return { success: true, providers, message: `${providers.length} prestadores encontrados` };
      }

      const providers = (data || [])
        .map((row: any) => {
          let provider = row.value || {};
          if (typeof provider === 'string') {
            try {
              provider = JSON.parse(provider);
            } catch (error) {
              console.warn('⚠️ Não foi possível parsear row.value como JSON:', error);
              provider = {};
            }
          }

          const providerLocation = row.provider_location
            || provider.provider_location
            || provider.providerLocation
            || provider.location
            || provider.currentLocation
            || { lat: location.lat + 0.002, lng: location.lng + 0.002 };

          const valueStatus = String(provider.status || '').toLowerCase();
          const statusBlocked = valueStatus === 'blocked';
          const isBlocked = this.isProviderBlockedForAvailability(provider) || statusBlocked;

          return {
            id: provider.id || row.key.replace('user:', ''),
            name: provider.name || provider.nome || provider.user_name || provider.userName,
            providerType: provider.providerType || provider.provider_type,
            vehicleModel: provider.vehicleModel || provider.vehicle_model,
            vehiclePlate: provider.vehiclePlate || provider.vehicle_plate,
            location: providerLocation,
            providerLocation,
            providerOn: isBlocked ? false : row.is_online,
            isOnline: isBlocked ? false : row.is_online,
            status: isBlocked ? 'blocked' : valueStatus || (row.is_online ? 'available' : 'offline'),
            isBlocked,
          };
        })
        .filter((provider: any) => {
          const hasDriverData = provider.name && provider.location && provider.location.lat != null && provider.location.lng != null;
          return hasDriverData && !provider.isBlocked;
        });

      console.log(`✅ ${providers.length} prestadores encontrados no KV store`);

      return {
        success: true,
        providers,
        message: `${providers.length} prestadores encontrados`
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar prestadores próximos:', error);
      throw error;
    }
  }

  async getProviderLocationById(providerId: string) {
    try {
      console.log('📍 Buscando localização do prestador:', providerId);

      const { data, error } = await supabase
        .from('kv_store_9dc5328a')
        .select('provider_location')
        .eq('key', `user:${providerId}`)
        .single();

      if (error) {
        console.warn('⚠️ Erro ao buscar localização do prestador:', error.message);
        return { success: false, location: null };
      }

      if (!data || !data.provider_location) {
        console.warn('⚠️ Prestador não encontrado ou sem localização');
        return { success: false, location: null };
      }

      console.log('✅ Localização encontrada:', data.provider_location);

      return {
        success: true,
        location: data.provider_location
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar localização do prestador:', error);
      return { success: false, location: null };
    }
  }

  async getAllProviderLocations() {
    try {
      console.log('📍 Buscando localização de todos os mecânicos no KV store...');

      const { data: kvData, error: kvError } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value, is_online, provider_location');

      if (!kvError && kvData && kvData.length > 0) {
        const kvProviders = (kvData || [])
          .map((row: any) => {
            const raw = row.value && typeof row.value === 'object' ? row.value : {};
            if (this.isProviderBlockedForAvailability({ value: raw })) {
              return null;
            }
            const location = row.provider_location ?? raw.providerLocation ?? raw.location ?? raw.provider_location ?? null;
            const lat = Number(location?.lat ?? location?.latitude ?? 0);
            const lng = Number(location?.lng ?? location?.longitude ?? 0);

            if (!location || Number.isNaN(lat) || Number.isNaN(lng) || lat === 0 || lng === 0) {
              return null;
            }

            return {
              id: raw.id || row.key?.replace('user:', ''),
              name: raw.name || raw.email || 'Mecânico',
              phone: raw.phone || null,
              email: raw.email || null,
              providerType: raw.providerType || raw.provider_type || 'Mecânico',
              location: { lat, lng },
              isOnline: Boolean(row.is_online ?? raw.isOnline ?? raw.is_online ?? false),
            };
          })
          .filter(Boolean);

        return { success: true, providers: kvProviders };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'provider');

      if (error && !this.isMissingTableError(error)) {
        throw new Error(error.message);
      }

      const providers = (data || [])
        .map((provider: any) => {
          if (this.isProviderBlockedForAvailability(provider)) {
            return null;
          }
          const location = provider.location || provider.provider_location || provider.providerLocation || null;
          const lat = Number(location?.lat ?? location?.latitude ?? 0);
          const lng = Number(location?.lng ?? location?.longitude ?? 0);

          if (!location || Number.isNaN(lat) || Number.isNaN(lng) || lat === 0 || lng === 0) {
            return null;
          }

          return {
            id: provider.id,
            name: provider.name || provider.email || 'Mecânico',
            phone: provider.phone || null,
            email: provider.email || null,
            providerType: provider.provider_type || provider.providerType || 'Mecânico',
            location: { lat, lng },
            isOnline: Boolean(provider.is_online ?? provider.isOnline ?? false),
          };
        })
        .filter(Boolean);

      return {
        success: true,
        providers,
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar localizações dos mecânicos:', error);
      return {
        success: false,
        providers: [],
        error: error.message || 'Erro ao buscar localizações dos mecânicos.',
      };
    }
  }

  async setProviderStatus(providerId: string, status: string) {
    try {
      if (!providerId) {
        throw new Error('ID do prestador obrigatório');
      }

      const normalizedStatus = String(status || 'available').toLowerCase();
      const isOnline = ['available', 'online', 'occupied'].includes(normalizedStatus);
      const now = new Date().toISOString();

      const { data: kvRow, error: kvReadError } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value, is_online, provider_location')
        .eq('key', `user:${providerId}`)
        .maybeSingle();
      if (kvReadError && !this.isMissingTableError(kvReadError)) {
        throw new Error(`Não foi possível verificar o bloqueio do prestador: ${kvReadError.message}`);
      }

      const kvValue = kvRow?.value && typeof kvRow.value === 'object' ? kvRow.value : {};
      if (isOnline && this.isProviderBlockedForAvailability({ value: kvValue })) {
        await this.upsertKvUserRow(providerId, kvValue, false, null);
        return {
          success: false,
          status: 'blocked',
          isOnline: false,
          error: 'O mecânico está bloqueado ou suspenso por dívida. Só poderá ficar disponível após regularização e confirmação.',
        };
      }

      const nextKvValue = {
        ...kvValue,
        id: providerId,
        isOnline,
        is_online: isOnline,
        status: String(kvValue.status || '').toLowerCase() === 'blocked' && !isOnline
          ? 'blocked'
          : normalizedStatus,
        providerLocation: isOnline ? kvValue.providerLocation ?? kvValue.provider_location ?? null : null,
        provider_location: isOnline ? kvValue.provider_location ?? kvValue.providerLocation ?? null : null,
        location: isOnline ? kvValue.location ?? null : null,
        updated_at: now,
        updatedAt: now,
      };

      await this.upsertKvUserRow(
        providerId,
        nextKvValue,
        isOnline,
        isOnline ? kvRow?.provider_location ?? kvValue.provider_location ?? kvValue.providerLocation ?? null : null,
      );

      return {
        success: true,
        status: normalizedStatus,
        isOnline,
        user: { id: providerId, is_online: isOnline, status: normalizedStatus },
      };
    } catch (error: any) {
      console.error('❌ Erro ao definir status do prestador:', error);
      return { success: false, error: error.message || 'Erro ao atualizar status' };
    }
  }

  async getProviderStatus(providerId: string) {
    try {
      const { data: kvRow, error: kvError } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value, is_online, provider_location')
        .eq('key', `user:${providerId}`)
        .maybeSingle();

      if (!kvError && kvRow) {
        const kvValue = kvRow.value && typeof kvRow.value === 'object' ? kvRow.value : {};
        const isBlocked = this.isProviderBlockedForAvailability({ value: kvValue });
        const isOnline = !isBlocked && Boolean(kvRow.is_online ?? kvValue.is_online ?? kvValue.isOnline ?? false);
        const status = isBlocked ? 'blocked' : String(kvValue.status || (isOnline ? 'available' : 'offline')).toLowerCase();

        return {
          success: true,
          status,
          isOnline,
          isBlocked,
          value: kvValue,
          providerLocation: isBlocked ? null : kvRow.provider_location ?? kvValue.provider_location ?? kvValue.providerLocation ?? null,
        };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', providerId)
        .maybeSingle();

      if (error && !this.isMissingTableError(error)) {
        console.warn('⚠️ Erro ao buscar status do prestador:', error.message);
      }

      const isBlocked = data ? this.isProviderBlockedForAvailability(data) : false;
      const isOnline = !isBlocked && Boolean((data as any)?.is_online ?? false);
      const status = isBlocked ? 'blocked' : String((data as any)?.status || (isOnline ? 'available' : 'offline')).toLowerCase();
      return {
        success: true,
        status,
        isOnline,
        isBlocked,
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar status do prestador:', error);
      return { success: false, status: 'offline', isOnline: false, error: error.message };
    }
  }

  async getSystemSettings() {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'system:settings')
        .maybeSingle();

      if (error && !this.isMissingTableError(error)) {
        throw new Error(error.message);
      }

      const settings = data?.value && typeof data.value === 'object' && !Array.isArray(data.value)
        ? data.value
        : {
            paymentMethodName: 'Multicaixa Express',
            multicaixaNumber: '929630902',
            defaultMulticaixaNumber: '929630902',
          };

      return {
        success: true,
        settings,
      };
    } catch (error: any) {
      console.warn('⚠️ Erro ao buscar configurações do sistema:', error.message);
      return {
        success: true,
        settings: {
          paymentMethodName: 'Multicaixa Express',
          multicaixaNumber: '929630902',
          defaultMulticaixaNumber: '929630902',
        },
      };
    }
  }

  async getTermsForRole(userRole: 'customer' | 'provider') {
    if (!['customer', 'provider'].includes(userRole)) {
      return { success: false, content: '', privacyNotice: '', error: 'Tipo de utilizador inválido.' };
    }

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'system:settings')
        .maybeSingle();

      if (error) throw error;

      const settings = data?.value && typeof data.value === 'object' && !Array.isArray(data.value)
        ? data.value as Record<string, unknown>
        : {};
      const key = userRole === 'provider' ? 'providerTerms' : 'customerTerms';
      const content = typeof settings[key] === 'string' ? settings[key].trim() : '';
      const privacyNotice = typeof settings.privacyNotice === 'string' ? settings.privacyNotice.trim() : '';
      if (!content) {
        throw new Error('Os termos e condições ainda não foram configurados.');
      }
      if (!privacyNotice) {
        throw new Error('O aviso de privacidade ainda não foi configurado.');
      }

      return { success: true, content, privacyNotice };
    } catch (error: any) {
      console.error('Erro ao carregar os termos e condições:', error);
      return {
        success: false,
        content: '',
        privacyNotice: '',
        error: error?.message || 'Não foi possível carregar os termos e condições.',
      };
    }
  }

  async ensureTermsAcceptance(userId: string, userRole: 'customer' | 'provider') {
    try {
      if (!userId || !['customer', 'provider'].includes(userRole)) {
        throw new Error('Não foi possível identificar a conta e o tipo de utilizador para verificar os termos.');
      }

      const { data: settingsRow, error: settingsError } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'system:settings')
        .maybeSingle();

      if (settingsError) throw settingsError;

      const settings = settingsRow?.value && typeof settingsRow.value === 'object' && !Array.isArray(settingsRow.value)
        ? settingsRow.value as Record<string, unknown>
        : {};
      const contentKey = userRole === 'provider' ? 'providerTerms' : 'customerTerms';
      const versionKey = userRole === 'provider' ? 'providerTermsVersion' : 'customerTermsVersion';
      const content = typeof settings[contentKey] === 'string' ? settings[contentKey].trim() : '';
      const privacyNotice = typeof settings.privacyNotice === 'string' ? settings.privacyNotice.trim() : '';
      const termsVersion = Math.max(1, Number(settings[versionKey]) || 1);
      const privacyNoticeVersion = Math.max(1, Number(settings.privacyNoticeVersion) || 1);
      const version = termsVersion + privacyNoticeVersion;

      if (!content) {
        throw new Error('Os termos e condições ainda não foram configurados. Contacte o administrador.');
      }
      if (!privacyNotice) {
        throw new Error('O aviso de privacidade ainda não foi configurado. Contacte o administrador.');
      }

      const { data: acceptance, error: acceptanceError } = await supabase
        .from('user_terms_acceptance')
        .select('has_seen, terms_version')
        .eq('user_id', userId)
        .eq('user_role', userRole)
        .maybeSingle();

      if (acceptanceError) throw acceptanceError;

      return {
        success: true,
        content,
        privacyNotice,
        version,
        hasSeen: Boolean(acceptance?.has_seen) && Number(acceptance?.terms_version || 0) >= version,
      };
    } catch (error: any) {
      const message = this.isMissingTableError(error)
        ? 'A configuração dos termos ainda não foi aplicada no banco de dados. Execute as migrações de termos no Supabase.'
        : error?.message || 'Não foi possível verificar os termos e condições.';
      console.error('Erro ao verificar a aceitação dos termos:', error);
      return {
        success: false,
        content: '',
        privacyNotice: '',
        version: 1,
        hasSeen: false,
        error: message,
      };
    }
  }

  async markTermsSeen(userId: string, userRole: 'customer' | 'provider', termsVersion: number) {
    try {
      if (!userId || !['customer', 'provider'].includes(userRole) || !Number.isInteger(termsVersion) || termsVersion < 1) {
        throw new Error('Os dados para confirmar os termos são inválidos.');
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from('user_terms_acceptance')
        .upsert({
          user_id: userId,
          user_role: userRole,
          has_seen: true,
          terms_version: termsVersion,
          accepted_at: now,
          updated_at: now,
        }, { onConflict: 'user_id,user_role' });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      const message = this.isMissingTableError(error)
        ? 'A tabela de aceitação dos termos não existe. Execute as migrações de termos no Supabase.'
        : error?.message || 'Não foi possível guardar a confirmação dos termos.';
      console.error('Erro ao guardar a aceitação dos termos:', error);
      return { success: false, error: message };
    }
  }

  async getPublicSupportContact() {
    const { settings } = await this.getSystemSettings();

    return {
      success: true,
      contact: {
        name: String(settings.supportContactName || ''),
        phone: String(settings.supportContactPhone || ''),
      },
    };
  }

  async syncProviderDebt(providerId: string, debtValue: number, debtDueDate?: string | null) {
    try {
      const now = new Date().toISOString();
      const { data: kvRow, error: kvReadError } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value, is_online, provider_location')
        .eq('key', `user:${providerId}`)
        .maybeSingle();
      if (kvReadError) throw new Error(kvReadError.message);

      const kvValue = kvRow?.value && typeof kvRow.value === 'object' ? kvRow.value : {};
      const requestedDebt = Math.max(0, Number(debtValue) || 0);
      const existingCredit = Math.max(0, Number(kvValue.credit_balance ?? 0) || 0);
      const shouldApplyCredit = kvValue.credit_prompt_choice === 'apply';
      const creditApplied = shouldApplyCredit ? Math.min(existingCredit, requestedDebt) : 0;
      const normalizedDebt = requestedDebt - creditApplied;
      const nextCredit = existingCredit - creditApplied;
      const finalDueDate = normalizedDebt > 0
        ? debtDueDate === undefined ? now : debtDueDate
        : null;
      const debtWasOverdue = this.isDebtOverdueForBlock({ value: kvValue });
      const manuallyBlocked = this.isProviderManuallyBlocked({ value: kvValue });
      const mustStayOffline = debtWasOverdue || manuallyBlocked;
      const mergedKvValue = {
        ...kvValue,
        id: providerId,
        debt: normalizedDebt,
        debt_amount: normalizedDebt,
        debt_due_date: finalDueDate,
        debtDueDate: finalDueDate,
        credit_balance: nextCredit,
        status: manuallyBlocked ? 'blocked' : debtWasOverdue ? 'offline' : kvValue.status,
        isOnline: mustStayOffline ? false : kvRow?.is_online ?? kvValue.isOnline ?? false,
        is_online: mustStayOffline ? false : kvRow?.is_online ?? kvValue.is_online ?? kvValue.isOnline ?? false,
        providerLocation: mustStayOffline ? null : kvValue.providerLocation ?? kvValue.provider_location ?? null,
        provider_location: mustStayOffline ? null : kvValue.provider_location ?? kvValue.providerLocation ?? null,
        location: mustStayOffline ? null : kvValue.location ?? null,
        updated_at: now,
      };

      await this.upsertKvUserRow(
        providerId,
        mergedKvValue,
        mustStayOffline ? false : kvRow?.is_online ?? kvValue.is_online ?? kvValue.isOnline ?? false,
        mustStayOffline ? null : kvRow?.provider_location ?? kvValue.provider_location ?? kvValue.providerLocation ?? null,
      );

      return {
        success: true,
        debt: normalizedDebt,
        debtDueDate: finalDueDate,
        creditBalance: nextCredit,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        debt: 0,
        debtDueDate: null,
      };
    }
  }

  async getProviderDebt(providerId: string) {
    try {
      const { data: kvRow, error: kvError } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value, is_online, provider_location')
        .eq('key', `user:${providerId}`)
        .maybeSingle();

      if (kvError && !this.isMissingTableError(kvError)) {
        throw new Error(kvError.message);
      }

      const kvValue = kvRow?.value && typeof kvRow.value === 'object' ? kvRow.value : {};
      const debt = Number(kvValue.debt ?? kvValue.debt_amount ?? 0) || 0;
      const debtDueDate = kvValue.debt_due_date ?? kvValue.debtDueDate ?? null;
      const creditBalance = Number(kvValue.credit_balance ?? 0) || 0;

      return {
        success: true,
        debt,
        debtDueDate,
        creditBalance,
        creditPromptPending: Boolean(kvValue.credit_prompt_pending),
      };
    } catch (error: any) {
      console.warn('⚠️ Erro ao buscar dívida do prestador:', error.message);
      return {
        success: false,
        error: error.message,
        debt: 0,
        debtDueDate: null,
        creditBalance: 0,
        creditPromptPending: false,
      };
    }
  }

  async applyCustomPaymentToProviderDebt(providerId: string, paymentReferenceId: string, paymentAmount: number) {
      try {
        const normalizedProviderId = String(providerId || '').trim();
        const normalizedReferenceId = String(paymentReferenceId || '').trim();
        const normalizedAmount = Number(paymentAmount);
        if (!normalizedProviderId || !normalizedReferenceId || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
          throw new Error('Mecânico, referência e valor de pagamento válidos são obrigatórios.');
        }

        const referenceKey = `payment_ref:${normalizedReferenceId.replace(/^payment_ref:/, '')}`;
        const { data: referenceRow, error: referenceReadError } = await supabase
          .from('kv_store_9dc5328a')
          .select('key, value')
          .eq('key', referenceKey)
          .maybeSingle();
        if (referenceReadError) {
          throw new Error(referenceReadError.message);
        }
        if (!referenceRow) {
          throw new Error('A referência de pagamento já não existe no sistema.');
        }

        const referenceValue = referenceRow.value && typeof referenceRow.value === 'object'
          ? referenceRow.value
          : {};
        const recordedProviderId = String(
          referenceValue.userId ??
          referenceValue.user_id ??
          referenceValue.mechanicId ??
          referenceValue.mechanic_id ??
          referenceValue.providerId ??
          referenceValue.provider_id ??
          '',
        );
        if (recordedProviderId !== normalizedProviderId) {
          throw new Error('A referência não pertence ao mecânico associado.');
        }
        if (
          ['approved', 'paid'].includes(String(referenceValue.status || '').toLowerCase()) &&
          referenceValue.confirmed_at
        ) {
          throw new Error('Esta referência já foi confirmada anteriormente.');
        }

        const { data: providerRow, error: providerReadError } = await supabase
          .from('kv_store_9dc5328a')
          .select('key, value, is_online, provider_location')
          .eq('key', `user:${normalizedProviderId}`)
          .maybeSingle();
        if (providerReadError) {
          throw new Error(providerReadError.message);
        }
        const providerValue = providerRow?.value && typeof providerRow.value === 'object'
          ? providerRow.value
          : {};
        const debtWasOverdue = this.isDebtOverdueForBlock({ value: providerValue });
        const settledReferences = Array.isArray(providerValue.custom_payment_settlements)
          ? providerValue.custom_payment_settlements.map(String)
          : [];
        const alreadySettled = settledReferences.includes(normalizedReferenceId);
        const now = new Date();
        const nowIso = now.toISOString();

        if (!alreadySettled) {
          const debt = Math.max(0, Number(providerValue.debt ?? providerValue.debt_amount ?? 0) || 0);
          const existingCredit = Math.max(0, Number(providerValue.credit_balance ?? 0) || 0);
          const appliedToDebt = Math.min(debt, normalizedAmount);
          const nextDebt = debt - appliedToDebt;
          const excess = normalizedAmount - appliedToDebt;
          const nextCredit = existingCredit + excess;
          const nextProviderIsBlocked =
            this.isProviderManuallyBlocked({ value: providerValue }) ||
            this.isDebtOverdueForBlock({
              value: {
                ...providerValue,
                debt: nextDebt,
                debt_amount: nextDebt,
              },
            });
          const forceOffline = debtWasOverdue || nextProviderIsBlocked;
          const partialPaymentDate = nextDebt > 0
            ? providerValue.debt_due_date ?? providerValue.debtDueDate ?? nowIso
            : null;
          const nextProviderValue = {
            ...providerValue,
            id: normalizedProviderId,
            debt: nextDebt,
            debt_amount: nextDebt,
            debt_due_date: partialPaymentDate,
            debtDueDate: partialPaymentDate,
            credit_balance: nextCredit,
            credit_prompt_pending: excess > 0 && !providerValue.credit_prompt_handled
              ? true
              : Boolean(providerValue.credit_prompt_pending),
            credit_prompt_handled: Boolean(providerValue.credit_prompt_handled),
            custom_payment_settlements: [...settledReferences, normalizedReferenceId],
            status: nextProviderIsBlocked
              ? this.isProviderManuallyBlocked({ value: providerValue }) ? 'blocked' : 'offline'
              : debtWasOverdue ? 'offline' : providerValue.status,
            isOnline: forceOffline ? false : providerRow?.is_online ?? providerValue.isOnline ?? false,
            is_online: forceOffline ? false : providerRow?.is_online ?? providerValue.is_online ?? providerValue.isOnline ?? false,
            providerLocation: forceOffline ? null : providerValue.providerLocation ?? providerValue.provider_location ?? null,
            provider_location: forceOffline ? null : providerValue.provider_location ?? providerValue.providerLocation ?? null,
            location: forceOffline ? null : providerValue.location ?? null,
            updated_at: nowIso,
            updatedAt: nowIso,
          };
          const { error: providerWriteError } = await supabase
            .from('kv_store_9dc5328a')
            .upsert({
              key: `user:${normalizedProviderId}`,
              value: nextProviderValue,
              is_online: forceOffline
                ? false
                : providerRow?.is_online ?? providerValue.is_online ?? providerValue.isOnline ?? false,
              provider_location: forceOffline
                ? null
                : providerRow?.provider_location ?? providerValue.provider_location ?? providerValue.providerLocation ?? null,
            });
          if (providerWriteError) {
            throw new Error(providerWriteError.message);
          }
        }

        const nextReferenceValue = {
          ...referenceValue,
          status: 'approved',
          approved: true,
          confirmed_at: referenceValue.confirmed_at || nowIso,
          custom_debt_settled: true,
          custom_settled_amount: normalizedAmount,
          note: `Confirmado pelo admin via lista personalizada${alreadySettled ? ' (liquidação já registada)' : ''}`,
          updated_at: nowIso,
          updatedAt: nowIso,
        };
        const { error: referenceWriteError } = await supabase
          .from('kv_store_9dc5328a')
          .upsert({ key: referenceKey, value: nextReferenceValue, is_online: false });
        if (referenceWriteError) {
          throw new Error(referenceWriteError.message);
        }

        const debtAfter = Math.max(
          0,
          Number(providerValue.debt ?? providerValue.debt_amount ?? 0) -
          Math.min(Number(providerValue.debt ?? providerValue.debt_amount ?? 0), normalizedAmount),
        );
        const creditAfter = Math.max(
          0,
          Number(providerValue.credit_balance ?? 0) +
          Math.max(0, normalizedAmount - Number(providerValue.debt ?? providerValue.debt_amount ?? 0)),
        );
        return {
          success: true,
          alreadySettled,
          debt: alreadySettled ? Number(providerValue.debt ?? providerValue.debt_amount ?? 0) || 0 : debtAfter,
          creditBalance: alreadySettled ? Number(providerValue.credit_balance ?? 0) || 0 : creditAfter,
        };
      } catch (error: any) {
        console.error('Erro ao confirmar pagamento personalizado:', error);
        throw new Error(error?.message || 'Não foi possível aplicar o pagamento personalizado.');
      }
    }

    async resolveProviderCredit(
      providerId: string,
      applyToDebt: boolean,
    ): Promise<
      | { success: true; debt: number; creditBalance: number; appliedToDebt: number }
      | { success: false; error: string }
    > {
      try {
        const { data: row, error } = await supabase
          .from('kv_store_9dc5328a')
          .select('key, value, is_online, provider_location')
          .eq('key', `user:${providerId}`)
          .maybeSingle();
        if (error) throw new Error(error.message);

        const value = row?.value && typeof row.value === 'object' ? row.value : {};
        const debtWasOverdue = this.isDebtOverdueForBlock({ value });
        const manuallyBlocked = this.isProviderManuallyBlocked({ value });
        const mustStayOffline = debtWasOverdue || manuallyBlocked;
        const credit = Math.max(0, Number(value.credit_balance ?? 0) || 0);
        const debt = Math.max(0, Number(value.debt ?? value.debt_amount ?? 0) || 0);
        const applied = applyToDebt ? Math.min(credit, debt) : 0;
        const nextDebt = debt - applied;
        const nextCredit = credit - applied;
        const nowIso = new Date().toISOString();
        const dueDate = nextDebt > 0
          ? value.debt_due_date ?? value.debtDueDate ?? nowIso
          : null;

        const nextValue = {
          ...value,
          debt: nextDebt,
          debt_amount: nextDebt,
          debt_due_date: dueDate,
          debtDueDate: dueDate,
          credit_balance: nextCredit,
          credit_prompt_pending: false,
          credit_prompt_handled: true,
          credit_prompt_choice: applyToDebt ? 'apply' : 'keep',
          credit_prompt_decided_at: nowIso,
          status: manuallyBlocked ? 'blocked' : debtWasOverdue ? 'offline' : value.status,
          isOnline: mustStayOffline ? false : row?.is_online ?? value.isOnline ?? false,
          is_online: mustStayOffline ? false : row?.is_online ?? value.is_online ?? value.isOnline ?? false,
          providerLocation: mustStayOffline ? null : value.providerLocation ?? value.provider_location ?? null,
          provider_location: mustStayOffline ? null : value.provider_location ?? value.providerLocation ?? null,
          location: mustStayOffline ? null : value.location ?? null,
          updated_at: nowIso,
          updatedAt: nowIso,
        };
        const { error: writeError } = await supabase
          .from('kv_store_9dc5328a')
          .upsert({
            key: `user:${providerId}`,
            value: nextValue,
            is_online: mustStayOffline ? false : row?.is_online ?? value.is_online ?? value.isOnline ?? false,
            provider_location: mustStayOffline ? null : row?.provider_location ?? value.provider_location ?? value.providerLocation ?? null,
          });
        if (writeError) throw new Error(writeError.message);

        return { success: true, debt: nextDebt, creditBalance: nextCredit, appliedToDebt: applied };
      } catch (error: any) {
        console.error('Erro ao decidir sobre o saldo positivo:', error);
        return { success: false, error: error?.message || 'Não foi possível atualizar o saldo positivo.' };
      }
    }

    async clearProviderCredit(providerId: string) {
      try {
        const { data: row, error } = await supabase
          .from('kv_store_9dc5328a')
          .select('key, value, is_online, provider_location')
          .eq('key', `user:${providerId}`)
          .maybeSingle();
        if (error) throw new Error(error.message);

        const value = row?.value && typeof row.value === 'object' ? row.value : {};
        const now = new Date().toISOString();
        const nextValue = {
          ...value,
          credit_balance: 0,
          credit_prompt_pending: false,
          credit_prompt_handled: true,
          credit_removed_at: now,
          updated_at: now,
          updatedAt: now,
        };
        const { error: writeError } = await supabase
          .from('kv_store_9dc5328a')
          .upsert({
            key: `user:${providerId}`,
            value: nextValue,
            is_online: row?.is_online ?? value.is_online ?? value.isOnline ?? false,
            provider_location: row?.provider_location ?? value.provider_location ?? value.providerLocation ?? null,
          });
        if (writeError) throw new Error(writeError.message);
        return { success: true };
      } catch (error: any) {
        console.error('Erro ao remover saldo positivo:', error);
        return { success: false, error: error?.message || 'Não foi possível remover o saldo positivo.' };
      }
    }

    async getProviderCredits() {
      try {
        const { data: rows, error } = await supabase
          .from('kv_store_9dc5328a')
          .select('key, value')
          .like('key', 'user:%');
        if (error) throw new Error(error.message);

        const credits = (rows || []).flatMap((row: any) => {
          const value = row.value && typeof row.value === 'object' ? row.value : {};
          const amount = Math.max(0, Number(value.credit_balance ?? 0) || 0);
          if (amount <= 0) return [];
          return [{
            providerId: String(value.id || row.key.replace(/^user:/, '')),
            name: String(value.name || value.full_name || 'Mecânico'),
            amount,
          }];
        });

        const providerIds = credits.map((item) => item.providerId);
        if (providerIds.length) {
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', providerIds);
          if (profileError) throw new Error(profileError.message);
          const names = new Map((profiles || []).map((profile: any) => [String(profile.id), String(profile.name || '')]));
          credits.forEach((credit) => {
            credit.name = names.get(credit.providerId) || credit.name;
          });
        }
        return { success: true, credits };
      } catch (error: any) {
        console.error('Erro ao carregar saldos positivos dos mecânicos:', error);
        return { success: false, error: error?.message || 'Não foi possível carregar os saldos positivos.', credits: [] };
      }
    }

  async getProviderMonthlyDebtAverage(providerId: string) {
    try {
      const { data: kvRow, error: kvError } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value')
        .eq('key', `user:${providerId}`)
        .maybeSingle();

      if (kvError && !this.isMissingTableError(kvError)) {
        console.warn('⚠️ Erro ao consultar dívida do prestador no KV:', kvError.message);
      }

      const kvValue = kvRow?.value && typeof kvRow.value === 'object' ? kvRow.value : {};
      const storedDebt = Number(kvValue.debt ?? kvValue.debt_amount ?? 0) || 0;

      if (storedDebt > 0 || kvRow) {
        return {
          success: true,
          averageDebt: Number(storedDebt.toFixed(2)),
        };
      }

      return {
        success: true,
        averageDebt: 0,
      };
    } catch (error: any) {
      console.warn('⚠️ Erro ao calcular média mensal da dívida no KV:', error.message);
      return { success: true, averageDebt: 0 };
    }
  }

  async submitPaymentReference(
    requestId: string,
    reference: string,
    amount: number,
    userId: string,
    paymentMethod?: string,
  ) {
    try {
      const cleanReference = String(reference || '').trim();
      const cleanAmount = Number(amount) || 0;
      if (!cleanReference || cleanAmount <= 0) {
        throw new Error('Referência e valor do pagamento são obrigatórios.');
      }

      const record = {
        id: `payment_ref:${requestId || Date.now()}`,
        request_id: requestId || `payment-${Date.now()}`,
        requestId: requestId || `payment-${Date.now()}`,
        user_id: userId,
        userId,
        reference: cleanReference,
        amount: cleanAmount,
        payment_method: paymentMethod || null,
        paymentMethod: paymentMethod || null,
        status: 'pending',
        note: 'Referência enviada pelo prestador',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const kvPayload = {
        key: `payment_ref:${record.requestId}`,
        value: record,
        is_online: false,
      };

      const { error } = await supabase.from('kv_store_9dc5328a').upsert(kvPayload);
      if (error) {
        throw new Error(error.message);
      }

      return { success: true, reference: record };
    } catch (error: any) {
      console.error('❌ Erro ao enviar referência de pagamento:', error);
      throw error;
    }
  }

  async getPaymentReferences() {
    try {
      const { data, error } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value')
        .like('key', 'payment_ref:%');

      if (error && !this.isMissingTableError(error)) {
        throw new Error(error.message);
      }

      const references = (data || [])
        .map((row: any) => {
          const value = row.value && typeof row.value === 'object' ? row.value : null;
          if (!value) return null;
          return {
            id: value.id || row.key,
            requestId: value.requestId || value.request_id || row.key.replace(/^payment_ref:/, ''),
            userId: value.userId || value.user_id || '',
            reference: value.reference || '',
            amount: Number(value.amount || 0),
            paymentMethod: value.paymentMethod || value.payment_method || '',
            status: value.status || 'pending',
            note: value.note || '',
            createdAt: value.created_at || value.createdAt,
            updatedAt: value.updated_at || value.updatedAt,
          };
        })
        .filter(Boolean);

      const { allowAll, ids } = await this.getCurrentAdminVisibilityScope();
      if (!allowAll && ids.size > 0) {
        return {
          success: true,
          references: references.filter((reference: any) => {
            if (!reference.userId) return false;
            return ids.has(String(reference.userId));
          }),
        };
      }

      return { success: true, references };
    } catch (error: any) {
      console.error('❌ Erro ao buscar referências de pagamento:', error);
      return { success: true, references: [] };
    }
  }

  async getAdminPaymentReferenceList() {
    const response = await this.getPaymentReferences();
    return {
      success: response.success,
      references: (response.references || []).map((item: any) => ({
        ...item,
        reference: item.reference,
        amount: Number(item.amount || 0),
      })),
    };
  }

  async getSavedPaymentReferenceList(): Promise<{ success: true; list: string[] }> {
    const { data, error } = await supabase
      .from('kv_store_9dc5328a')
      .select('value')
      .eq('key', 'admin:payment_reference_list')
      .maybeSingle();
    if (error) throw new Error(`Não foi possível carregar a lista de referências: ${error.message}`);

    const value = data?.value && typeof data.value === 'object' ? data.value : {};
    const list = Array.isArray(value.list)
      ? value.list.map((entry: unknown) => String(entry).trim()).filter(Boolean)
      : [];
    return { success: true, list };
  }

  async savePaymentReferenceList(list: string[]): Promise<{ success: true; list: string[] }> {
    const normalizedList = [...new Set(
      list.map((entry) => String(entry).trim()).filter(Boolean),
    )];
    if (normalizedList.length === 0) {
      throw new Error('A lista precisa conter pelo menos uma referência válida.');
    }

    const { error } = await supabase
      .from('kv_store_9dc5328a')
      .upsert({
        key: 'admin:payment_reference_list',
        value: { list: normalizedList, updated_at: new Date().toISOString() },
        is_online: false,
      });
    if (error) throw new Error(`Não foi possível guardar a lista de referências: ${error.message}`);
    return { success: true, list: normalizedList };
  }

  async clearSavedPaymentReferenceList(): Promise<{ success: true }> {
    const { error } = await supabase
      .from('kv_store_9dc5328a')
      .delete()
      .eq('key', 'admin:payment_reference_list');
    if (error) throw new Error(`Não foi possível eliminar a lista de referências: ${error.message}`);
    return { success: true };
  }

  async createAdminUser(email: string, password: string, name: string, role: 'admin' | 'super_admin') {
    try {
      const normalizedRole = role === 'super_admin' ? 'super_admin' : 'admin';
      const cleanEmail = String(email || '').trim().toLowerCase().replace(/\s/g, '');
      const cleanName = String(name || '').trim();

      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error('Email inválido. Verifique o formato antes de criar a conta.');
      }

      if (!cleanName) {
        throw new Error('Nome do administrador é obrigatório.');
      }

      if (password.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres.');
      }

      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser?.user) {
        throw new Error('Você precisa estar autenticado para criar usuários administrativos.');
      }

      const { data: currentProfile, error: currentProfileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.user.id)
        .maybeSingle();

      if (currentProfileError && !this.isMissingTableError(currentProfileError)) {
        throw new Error(currentProfileError.message || 'Não foi possível verificar sua permissão.');
      }

      const currentRole = this.normalizeUserRole(currentProfile?.role || authUser.user.user_metadata?.role || authUser.user.app_metadata?.role || 'customer');
      if (currentRole !== 'super_admin') {
        throw new Error('Apenas um superadministrador pode criar contas administrativas.');
      }

      const { data: existingProfile, error: emailCheckError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (emailCheckError && !this.isMissingTableError(emailCheckError)) {
        throw new Error(emailCheckError.message || 'Não foi possível verificar o email cadastrado.');
      }

      if (existingProfile) {
        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({
            name: cleanName,
            role: normalizedRole,
            phone: existingProfile.phone || '',
            provider_type: existingProfile.provider_type || null,
            vehicle_model: existingProfile.vehicle_model || null,
            vehicle_plate: existingProfile.vehicle_plate || null,
            is_online: Boolean(existingProfile.is_online),
            location: existingProfile.location || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingProfile.id);

        if (updateProfileError && !this.isMissingTableError(updateProfileError)) {
          throw new Error(updateProfileError.message || 'Não foi possível atualizar o perfil existente.');
        }

        return {
          success: true,
          message: normalizedRole === 'super_admin'
            ? 'Perfil de superadministrador atualizado com sucesso. O e-mail já existia no banco e foi reutilizado.'
            : 'Perfil de administrador atualizado com sucesso. O e-mail já existia no banco e foi reutilizado.',
          userId: existingProfile.id,
          existed: true,
        };
      }

      const redirectUrl = getEmailConfirmationRedirect();

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanName,
            role: normalizedRole,
            phone: '',
            providerType: null,
            vehicleModel: null,
            vehiclePlate: null,
            is_online: false,
            provider_location: null,
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (signUpError) {
        const lower = String(signUpError.message || '').toLowerCase();
        const isDuplicateEmail = lower.includes('already registered') || lower.includes('email already registered') || lower.includes('user already exists') || lower.includes('already exists');

        if (isDuplicateEmail) {
          const { data: duplicateProfile, error: duplicateProfileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

          if (!duplicateProfileError && duplicateProfile) {
            const { error: updateExistingError } = await supabase
              .from('profiles')
              .update({
                name: cleanName,
                role: normalizedRole,
                phone: duplicateProfile.phone || '',
                provider_type: duplicateProfile.provider_type || null,
                vehicle_model: duplicateProfile.vehicle_model || null,
                vehicle_plate: duplicateProfile.vehicle_plate || null,
                is_online: Boolean(duplicateProfile.is_online),
                location: duplicateProfile.location || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', duplicateProfile.id);

            if (!updateExistingError || this.isMissingTableError(updateExistingError)) {
              return {
                success: true,
                message: normalizedRole === 'super_admin'
                  ? 'O superadministrador foi reativado no perfil existente com o e-mail informado.'
                  : 'O administrador foi reativado no perfil existente com o e-mail informado.',
                userId: duplicateProfile.id,
                existed: true,
              };
            }
          }
        }

        throw new Error(this.translateAuthError(signUpError.message));
      }

      const userId = authData?.user?.id;
      if (!userId) {
        throw new Error('Não foi possível criar a conta administrativa.');
      }

      const { error: profileInsertError } = await supabase
        .from('profiles')
        .insert([
          {
            id: userId,
            email: cleanEmail,
            name: cleanName,
            phone: '',
            role: normalizedRole,
            provider_type: null,
            vehicle_model: null,
            vehicle_plate: null,
            is_online: false,
            location: null,
            created_at: new Date().toISOString(),
          },
        ]);

      if (profileInsertError && !this.isMissingTableError(profileInsertError)) {
        console.warn('⚠️ Perfil administrativo criado no Auth, mas falhou em profiles:', profileInsertError.message);
      }

      const { error: kvError } = await supabase
        .from('kv_store_9dc5328a')
        .upsert({
          key: `user:${userId}`,
          value: {
            id: userId,
            email: cleanEmail,
            name: cleanName,
            phone: '',
            role: normalizedRole,
            providerType: null,
            vehicleModel: null,
            vehiclePlate: null,
            isOnline: false,
            providerLocation: null,
          },
          is_online: false,
        });

      if (kvError && !this.isMissingTableError(kvError)) {
        console.warn('⚠️ Falha ao salvar administrador no KV store:', kvError.message);
      }

      return {
        success: true,
        message: normalizedRole === 'super_admin'
          ? 'Superadministrador criado com sucesso. O utilizador deve confirmar o e-mail para ativar a conta.'
          : 'Administrador criado com sucesso. O utilizador deve confirmar o e-mail para ativar a conta.',
        userId,
      };
    } catch (error: any) {
      console.error('❌ Erro ao criar usuário administrativo:', error);
      return {
        success: false,
        error: error?.message || 'Não foi possível criar a conta administrativa.',
      };
    }
  }

  async getStoredUser() {
    try {
      const storedId = this.getStoredSessionUserId();
      if (storedId) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', storedId)
          .maybeSingle();

        if (!error && data) {
          return {
            success: true,
            user: {
              id: data.id,
              email: data.email,
              name: data.name,
              phone: data.phone,
              role: this.normalizeUserRole(data.role),
              providerType: data.provider_type,
              vehicleModel: data.vehicle_model,
              vehiclePlate: data.vehicle_plate,
              documentType: data.document_type || '',
              documentUrl: data.document_url || '',
              isOnline: Boolean(data.is_online),
            },
          };
        }
      }

      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser?.user) {
        return { success: true, user: null };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.user.id)
        .maybeSingle();

      const user = profile || {
        id: authUser.user.id,
        email: authUser.user.email,
        name: authUser.user.user_metadata?.name || authUser.user.email,
        phone: authUser.user.user_metadata?.phone || '',
        role: this.normalizeUserRole(authUser.user.user_metadata?.role || authUser.user.app_metadata?.role || 'customer'),
        provider_type: authUser.user.user_metadata?.providerType || authUser.user.user_metadata?.provider_type || null,
        vehicle_model: authUser.user.user_metadata?.vehicleModel || authUser.user.user_metadata?.vehicle_model || null,
        vehicle_plate: authUser.user.user_metadata?.vehiclePlate || authUser.user.user_metadata?.vehicle_plate || null,
        document_type: authUser.user.user_metadata?.documentType || null,
        document_url: authUser.user.user_metadata?.documentUrl || null,
        is_online: Boolean(authUser.user.user_metadata?.is_online),
      };

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone || '',
          role: this.normalizeUserRole(user.role),
          providerType: user.provider_type,
          vehicleModel: user.vehicle_model,
          vehiclePlate: user.vehicle_plate,
          documentType: user.document_type || '',
          documentUrl: user.document_url || '',
          isOnline: Boolean(user.is_online),
        },
      };
    } catch (error: any) {
      console.warn('⚠️ Erro ao buscar usuário armazenado:', error.message);
      return { success: true, user: null };
    }
  }

  async getServiceCatalog() {
    try {
      const { data, error } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value')
        .eq('key', 'service_catalog')
        .maybeSingle();

      if (error && !this.isMissingTableError(error)) {
        throw new Error(error.message);
      }

      const catalog = data?.value && Array.isArray(data.value) ? data.value : DEFAULT_SERVICE_CATALOG;
      return { success: true, services: catalog };
    } catch (error: any) {
      console.warn('⚠️ Erro ao buscar catálogo de serviços:', error.message);
      return { success: true, services: DEFAULT_SERVICE_CATALOG };
    }
  }

  async saveServiceCatalog(services: any[]) {
    try {
      const catalog = Array.isArray(services) && services.length > 0 ? services : DEFAULT_SERVICE_CATALOG;
      const { error } = await supabase
        .from('kv_store_9dc5328a')
        .upsert({ key: 'service_catalog', value: catalog, is_online: false });

      if (error && !this.isMissingTableError(error)) {
        throw new Error(error.message);
      }

      return { success: true, services: catalog };
    } catch (error: any) {
      console.error('❌ Erro ao salvar catálogo de serviços:', error);
      return { success: false, error: error.message, services: DEFAULT_SERVICE_CATALOG };
    }
  }

  async deleteServiceFromCatalog(serviceId: string) {
    try {
      const response = await this.getServiceCatalog();
      const nextCatalog = (response.services || []).filter((item: any) => String(item.id) !== String(serviceId));
      const saveResponse = await this.saveServiceCatalog(nextCatalog);
      return saveResponse;
    } catch (error: any) {
      console.error('❌ Erro ao remover serviço do catálogo:', error);
      return { success: false, error: error.message };
    }
  }

  async uploadServiceIcon(file: File): Promise<string> {
    const allowedTypes: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = allowedTypes[file.type];
    if (!extension) {
      throw new Error('Formato inválido. Use uma imagem PNG, JPG ou WebP.');
    }
    if (file.size === 0 || file.size > 2 * 1024 * 1024) {
      throw new Error('A imagem deve ter até 2 MB.');
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error('Inicie sessão para enviar o ícone.');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!['admin', 'super_admin'].includes(this.normalizeUserRole(profile?.role))) {
      throw new Error('Apenas administradores podem enviar ícones de serviço.');
    }

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const { data, error } = await supabase.storage
      .from('service-icons')
      .upload(filename, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });
    if (error) {
      throw new Error(`Não foi possível enviar o ícone: ${error.message}`);
    }

    const { data: publicUrl } = supabase.storage
      .from('service-icons')
      .getPublicUrl(data.path);
    if (!publicUrl.publicUrl) throw new Error('O ícone foi enviado, mas não foi possível obter o endereço público.');
    return publicUrl.publicUrl;
  }

  private async requireCleanupRole(superAdminOnly = false) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error('Inicie sessão para gerir os dados.');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);

    const role = this.normalizeUserRole(profile?.role);
    if (superAdminOnly ? role !== 'super_admin' : !['admin', 'super_admin'].includes(role)) {
      throw new Error(superAdminOnly
        ? 'A exclusão definitiva só pode ser executada por um superadministrador.'
        : 'Apenas administradores podem gerir a limpeza de dados.');
    }
  }

  private cleanupCutoff(section: string, retention: string): string {
    const retentionDays: Record<string, number> = {
      'requests:6months': 183,
      'requests:12months': 365,
      'requests:18months': 548,
      'notifications:90days': 90,
      'notifications:180days': 180,
      'notifications:365days': 365,
      'messages:12months': 365,
      'messages:24months': 730,
      'messages:36months': 1095,
      'locations:30days': 30,
      'locations:60days': 60,
      'locations:90days': 90,
      'financial:archive': 365,
      'financial:delete': 365,
    };
    const days = retentionDays[`${section}:${retention}`];
    if (!days) throw new Error('Período de retenção inválido para esta categoria.');
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  private async getCleanupCandidates(section: string, retention: string) {
    const cutoff = this.cleanupCutoff(section, retention);

    if (section === 'requests') {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .lt('created_at', cutoff);
      if (error) throw new Error(`Não foi possível consultar solicitações antigas: ${error.message}`);
      const terminalStatuses = new Set(['completed', 'finalized', 'cancelled', 'canceled', 'rejected', 'deleted']);
      return (data || [])
        .filter((row: any) => terminalStatuses.has(String(row.status || '').toLowerCase()))
        .map((row: any) => ({
          tableName: 'service_requests',
          id: String(row.id),
          payload: row,
          sourceCreatedAt: row.created_at || null,
        }));
    }

    if (section === 'messages') {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .lt('created_at', cutoff);
      if (error) throw new Error(`Não foi possível consultar mensagens antigas: ${error.message}`);
      return (data || []).map((row: any) => ({
        tableName: 'messages',
        id: String(row.id),
        payload: row,
        sourceCreatedAt: row.created_at || null,
      }));
    }

    if (section === 'notifications' || section === 'locations' || section === 'financial') {
      const keyPattern = section === 'notifications'
        ? 'notification:%'
        : section === 'locations'
          ? 'user:%'
          : 'payment_ref:%';
      const { data, error } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value, is_online, provider_location')
        .like('key', keyPattern);
      if (error) throw new Error(`Não foi possível consultar os dados antigos: ${error.message}`);

      return (data || []).flatMap((row: any) => {
        const value = row.value && typeof row.value === 'object' ? row.value : {};
        if (section === 'locations') {
          const location = row.provider_location || value.provider_location || value.providerLocation || value.location;
          if (!location) return [];
          const locationDate = location.updated_at || location.updatedAt || location.timestamp
            || value.location_updated_at || value.locationUpdatedAt || value.provider_location_updated_at;
          const locationTimestamp = Date.parse(locationDate || '');
          if (!Number.isFinite(locationTimestamp) || locationTimestamp >= Date.parse(cutoff)) return [];
          return [{
            tableName: 'kv_store_9dc5328a',
            id: row.key,
            payload: row,
            sourceCreatedAt: locationDate,
          }];
        }

        const createdAt = value.created_at || value.createdAt || value.updated_at || value.updatedAt;
        const createdTimestamp = Date.parse(createdAt || '');
        if (!Number.isFinite(createdTimestamp) || createdTimestamp >= Date.parse(cutoff)) return [];
        if (section === 'financial') {
          const status = String(value.status || '').toLowerCase();
          if (!['confirmed', 'rejected', 'cancelled', 'canceled'].includes(status)) return [];
          if (retention === 'delete' && status !== 'rejected') return [];
        }
        return [{
          tableName: 'kv_store_9dc5328a',
          id: row.key,
          payload: row,
          sourceCreatedAt: createdAt,
        }];
      });
    }

    throw new Error('Categoria de limpeza inválida.');
  }

  private async removeCleanupCandidates(section: string, candidates: any[]) {
    if (!candidates.length) return;
    const pageSize = 250;
    const deleteRows = async (table: string, column: string, ids: string[]) => {
      for (let index = 0; index < ids.length; index += pageSize) {
        const { error } = await supabase
          .from(table)
          .delete()
          .in(column, ids.slice(index, index + pageSize));
        if (error) throw new Error(`Não foi possível remover dados de ${table}: ${error.message}`);
      }
    };

    if (section === 'requests') {
      const ids = candidates.map((item) => item.id);
      await deleteRows('service_requests', 'id', ids);
      const kvKeys = ids.map((id) => `service:${id}`);
      for (let index = 0; index < kvKeys.length; index += pageSize) {
        const { error } = await supabase.from('kv_store_9dc5328a').delete().in('key', kvKeys.slice(index, index + pageSize));
        if (error && !this.isMissingTableError(error)) throw new Error(`Não foi possível remover solicitações do KV: ${error.message}`);
      }
      return;
    }

    if (section === 'locations') {
      for (const candidate of candidates) {
        const row = candidate.payload;
        const value = row.value && typeof row.value === 'object' ? row.value : {};
        const nextValue = {
          ...value,
          providerLocation: null,
          provider_location: null,
          location: null,
          location_updated_at: null,
          locationUpdatedAt: null,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('kv_store_9dc5328a').upsert({
          key: row.key,
          value: nextValue,
          is_online: Boolean(row.is_online),
          provider_location: null,
        });
        if (error) throw new Error(`Não foi possível limpar a localização antiga: ${error.message}`);
      }
      return;
    }

    if (section === 'messages') {
      await deleteRows('messages', 'id', candidates.map((item) => item.id));
      return;
    }

    await deleteRows('kv_store_9dc5328a', 'key', candidates.map((item) => item.id));
  }

  async getCleanupAnalysis() {
    try {
      await this.requireCleanupRole();
      const { data: usageRows, error: usageError } = await supabase.rpc('get_admin_data_usage_summary');
      if (usageError) throw new Error(`Não foi possível calcular o espaço usado: ${usageError.message}`);
      const databaseBytes = (usageRows || []).reduce((total: number, row: any) => total + (Number(row.size_bytes) || 0), 0);

      const { data: archiveRows, error: archiveError } = await supabase
        .from('admin_data_archives')
        .select('payload');
      if (archiveError) throw new Error(`Não foi possível consultar os dados arquivados: ${archiveError.message}`);
      const encoder = new TextEncoder();
      const archivedBytes = (archiveRows || []).reduce(
        (total: number, row: any) => total + encoder.encode(JSON.stringify(row.payload || {})).length,
        0,
      );

      const defaultRetention = {
        requests: '6months',
        notifications: '90days',
        messages: '12months',
        locations: '30days',
        financial: 'archive',
      };
      const candidates = await Promise.all(
        Object.entries(defaultRetention).map(([section, retention]) => this.getCleanupCandidates(section, retention)),
      );
      const removableBytes = candidates.flat().reduce(
        (total: number, item: any) => total + encoder.encode(JSON.stringify(item.payload || {})).length,
        0,
      );
      const bytesPerGb = 1024 ** 3;
      const databaseUsed = databaseBytes / bytesPerGb;

      return {
        success: true,
        stats: {
          databaseUsed,
          archivedData: archivedBytes / bytesPerGb,
          removableData: removableBytes / bytesPerGb,
          isAboveLimit: databaseUsed > 3,
        },
      };
    } catch (error: any) {
      console.error('Erro ao analisar a limpeza de dados:', error);
      return { success: false, error: error?.message || 'Não foi possível analisar a limpeza de dados.' };
    }
  }

  async archiveCleanupData(section: string, retention: string) {
    try {
      await this.requireCleanupRole();
      if (section === 'financial' && retention === 'keep') {
        throw new Error('O histórico financeiro está configurado para ser mantido.');
      }
      const candidates = await this.getCleanupCandidates(section, retention);
      if (!candidates.length) return { success: true, archivedCount: 0 };

      const rows = candidates.map((item: any) => ({
        category: section,
        table_name: item.tableName,
        original_id: item.id,
        payload: item.payload,
        source_created_at: item.sourceCreatedAt,
        status: 'archived',
      }));
      const { error } = await supabase
        .from('admin_data_archives')
        .upsert(rows, { onConflict: 'category,table_name,original_id' });
      if (error) throw new Error(`Não foi possível arquivar os registos: ${error.message}`);

      await this.removeCleanupCandidates(section, candidates);
      return { success: true, archivedCount: candidates.length };
    } catch (error: any) {
      console.error('Erro ao arquivar dados antigos:', error);
      return { success: false, error: error?.message || 'Não foi possível arquivar os dados antigos.' };
    }
  }

  async deleteCleanupData(section: string, retention: string) {
    try {
      await this.requireCleanupRole(true);
      if (section === 'financial' && retention !== 'delete') {
        throw new Error('Selecione a opção de exclusão de registos financeiros conflitantes.');
      }
      const candidates = await this.getCleanupCandidates(section, retention);
      await this.removeCleanupCandidates(section, candidates);
      return { success: true, deletedCount: candidates.length };
    } catch (error: any) {
      console.error('Erro ao excluir dados antigos:', error);
      return { success: false, error: error?.message || 'Não foi possível excluir os dados antigos.' };
    }
  }

  async getAdminDashboardStats() {
    try {
      const pageSize = 1000;
      const loadAll = async (loadPage: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>) => {
        const rows: any[] = [];
        for (let from = 0; ; from += pageSize) {
          const { data, error } = await loadPage(from, from + pageSize - 1);
          if (error) throw error;
          const page = data || [];
          rows.push(...page);
          if (page.length < pageSize) return rows;
        }
      };

      const [profileRows, kvUserRows, requestRows, paymentRows, reviewRows] = await Promise.all([
        loadAll((from, to) => supabase.from('profiles').select('*').range(from, to)),
        loadAll((from, to) => supabase.from('kv_store_9dc5328a').select('key, value, is_online').like('key', 'user:%').range(from, to)),
        loadAll((from, to) => supabase.from('service_requests').select('*').range(from, to)),
        loadAll((from, to) => supabase.from('kv_store_9dc5328a').select('key, value').like('key', 'payment_ref:%').range(from, to)),
        loadAll((from, to) => supabase.from('mechanic_reviews').select('rating, created_at').range(from, to)),
      ]);

      let loginSessions: any[] | null = [];
      try {
        loginSessions = await loadAll((from, to) =>
          supabase.from('user_login_sessions').select('user_id, started_at').range(from, to)
        );
      } catch (sessionError) {
        console.warn('Estatísticas de sessão indisponíveis. Execute a migração de sessões no Supabase:', sessionError);
        loginSessions = null;
      }

      const kvUsers = kvUserRows.map((row: any) => {
        const value = row.value && typeof row.value === 'object' ? row.value : {};
        return {
          id: value.id || row.key?.replace('user:', '') || row.key,
          role: this.normalizeUserRole(value.role),
          is_online: Boolean(row.is_online ?? value.isOnline ?? value.is_online ?? false),
          is_blocked: Boolean(value.is_blocked ?? value.isBlocked),
        };
      });
      const usersById = new Map<string, any>();
      for (const kvUser of kvUsers) {
        usersById.set(String(kvUser.id), kvUser);
      }
      for (const profile of profileRows) {
        const matchingKvUser = usersById.get(String(profile.id));
        usersById.set(String(profile.id), {
          ...matchingKvUser,
          ...profile,
          role: this.normalizeUserRole(profile.role || matchingKvUser?.role),
          is_online: Boolean(profile.is_online ?? matchingKvUser?.is_online),
          is_blocked: Boolean(profile.is_blocked ?? matchingKvUser?.is_blocked),
        });
      }
      const users = Array.from(usersById.values());
      const clientsData = users.filter((item: any) => item.role === 'customer');
      const mechanicsData = users.filter((item: any) => item.role === 'provider');
      const adminsData = users.filter((item: any) => ['admin', 'super_admin'].includes(item.role));
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const twelveMonthStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const isInRange = (value: unknown, start: Date, end: Date) => {
        if (typeof value !== 'string' || !value) return false;
        const date = new Date(value);
        return !Number.isNaN(date.getTime()) && date >= start && date < end;
      };
      const currentMonthServices = requestRows.filter((item: any) => isInRange(item.created_at, monthStart, nextMonthStart));
      const twelveMonthServices = requestRows.filter((item: any) => isInRange(item.created_at, twelveMonthStart, nextMonthStart));
      const confirmedPayments = paymentRows
        .map((row: any) => row.value && typeof row.value === 'object' ? row.value : null)
        .filter((payment: any) => payment && (payment.approved === true || ['approved', 'paid'].includes(String(payment.status || '').toLowerCase())))
        .map((payment: any) => ({
          amount: Number(payment.amount || 0),
          confirmedAt: payment.confirmed_at || payment.paid_at || payment.updated_at || payment.updatedAt,
        }))
        .filter((payment: any) => Number.isFinite(payment.amount) && payment.amount > 0);
      const currentMonthPayments = confirmedPayments.filter((payment: any) =>
        isInRange(payment.confirmedAt, monthStart, nextMonthStart)
      );
      const currentMonthSessions = (loginSessions || []).filter((session: any) =>
        isInRange(session.started_at, monthStart, nextMonthStart)
      );
      const activeUserIdsThisMonth = new Set(currentMonthSessions.map((session: any) => String(session.user_id)));
      const sessionsAvailable = loginSessions !== null;
      const currentMonthPaidTotal = currentMonthPayments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
      const averageMechanicRating = reviewRows.length
        ? reviewRows.reduce((sum: number, review: any) => sum + (Number(review.rating) || 0), 0) / reviewRows.length
        : 0;
      const requestsData = requestRows;
      const stats = {
        totalClients: clientsData.length,
        totalMechanics: mechanicsData.length,
        totalUsers: clientsData.length + mechanicsData.length,
        totalAdmins: adminsData.length,
        totalServices: requestsData.length,
        servicesPending: requestsData.filter((item: any) => String(item.status).toLowerCase() === 'pending').length,
        servicesInProgress: requestsData.filter((item: any) => ['in_progress', 'accepted', 'assigned', 'em_andamento'].includes(String(item.status).toLowerCase())).length,
        servicesCompleted: requestsData.filter((item: any) => ['completed', 'finalized', 'finalizado', 'concluido', 'done'].includes(String(item.status).toLowerCase())).length,
        servicesCancelled: requestsData.filter((item: any) => ['cancelled', 'canceled', 'rejected', 'cancelada'].includes(String(item.status).toLowerCase())).length,
        activeMechanics: mechanicsData.filter((item: any) => Boolean(item.is_online)).length,
        inactiveMechanics: mechanicsData.filter((item: any) => !Boolean(item.is_online)).length,
        onlineMechanics: mechanicsData.filter((item: any) => Boolean(item.is_online)).length,
        offlineMechanics: mechanicsData.filter((item: any) => !Boolean(item.is_online)).length,
        blockedClients: clientsData.filter((item: any) => Boolean(item.is_blocked)).length,
        clientsOnline: clientsData.filter((item: any) => Boolean(item.is_online)).length,
        monthlyLoginSessions: sessionsAvailable ? currentMonthSessions.length : null,
        monthlyActiveUsers: sessionsAvailable ? activeUserIdsThisMonth.size : null,
        monthlyUserUsagePercent: sessionsAvailable && clientsData.length + mechanicsData.length > 0
          ? Number(((activeUserIdsThisMonth.size / (clientsData.length + mechanicsData.length)) * 100).toFixed(1))
          : sessionsAvailable ? 0 : null,
        sessionTrackingAvailable: sessionsAvailable,
        monthlyConfirmedPaymentCount: currentMonthPayments.length,
        monthlyConfirmedPaymentTotal: Number(currentMonthPaidTotal.toFixed(2)),
        monthlyConfirmedPaymentAverage: currentMonthPayments.length
          ? Number((currentMonthPaidTotal / currentMonthPayments.length).toFixed(2))
          : 0,
        monthlyServiceRequests: currentMonthServices.length,
        averageMonthlyServiceRequests: Number((twelveMonthServices.length / 12).toFixed(1)),
        averageMechanicRating: Number(averageMechanicRating.toFixed(2)),
        mechanicReviewCount: reviewRows.length,
      };

      return { success: true, stats };
    } catch (error: any) {
      console.warn('⚠️ Erro ao montar estatísticas administrativas:', error.message);
      return {
        success: true,
        stats: {
          totalClients: 0,
          totalMechanics: 0,
          totalUsers: 0,
          totalAdmins: 0,
          totalServices: 0,
          servicesPending: 0,
          servicesInProgress: 0,
          servicesCompleted: 0,
          servicesCancelled: 0,
          activeMechanics: 0,
          inactiveMechanics: 0,
          onlineMechanics: 0,
          offlineMechanics: 0,
          blockedClients: 0,
          clientsOnline: 0,
          monthlyLoginSessions: null,
          monthlyActiveUsers: null,
          monthlyUserUsagePercent: null,
          sessionTrackingAvailable: false,
          monthlyConfirmedPaymentCount: 0,
          monthlyConfirmedPaymentTotal: 0,
          monthlyConfirmedPaymentAverage: 0,
          monthlyServiceRequests: 0,
          averageMonthlyServiceRequests: 0,
          averageMechanicRating: 0,
          mechanicReviewCount: 0,
        },
      };
    }
  }

  async getRevenueStats() {
    try {
      const { data, error } = await supabase
        .from('finalizado')
        .select('final_price, created_at')
        .order('created_at', { ascending: false });

      if (error && !this.isMissingTableError(error)) {
        throw new Error(error.message);
      }

      const totalRevenue = (data || []).reduce((sum: number, item: any) => sum + Number(item.final_price || 0), 0);
      return { success: true, revenue: { totalRevenue } };
    } catch (error: any) {
      return { success: true, revenue: { totalRevenue: 0 } };
    }
  }

  async getAverageTimes() {
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error && !this.isMissingTableError(error)) {
        throw new Error(error.message);
      }

      const list = (data || []).filter((item: any) => item.created_at && item.updated_at);
      const averageMinutes = list.length > 0
        ? list.reduce((sum: number, item: any) => {
            const diff = new Date(item.updated_at).getTime() - new Date(item.created_at).getTime();
            return sum + Math.max(0, diff / 60000);
          }, 0) / list.length
        : 0;

      return { success: true, times: { averageMinutes: Number(averageMinutes.toFixed(1)) } };
    } catch (error: any) {
      return { success: true, times: { averageMinutes: 0 } };
    }
  }

  async getAdminStatisticsSnapshots() {
    try {
      const { data, error } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value')
        .like('key', 'admin_stats_snapshot:%');

      if (error && !this.isMissingTableError(error)) {
        throw new Error(error.message);
      }

      const snapshots = (data || [])
        .map((row: any) => row.value)
        .filter((item: any) => item && item.snapshot)
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      return { success: true, snapshots };
    } catch (error: any) {
      return { success: true, snapshots: [] };
    }
  }

  async saveAdminStatisticsSnapshot(stats: any) {
    try {
      const snapshot = {
        id: `snapshot-${Date.now()}`,
        snapshot: stats,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('kv_store_9dc5328a')
        .upsert({ key: `admin_stats_snapshot:${snapshot.id}`, value: snapshot, is_online: false });

      if (error && !this.isMissingTableError(error)) {
        throw new Error(error.message);
      }

      return { success: true, snapshot };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getAdminClientList(search?: string) {
    try {
      let query = supabase.from('profiles').select('*').eq('role', 'customer');
      if (search && search.trim()) {
        const q = search.trim();
        query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error && !this.isMissingTableError(error)) throw new Error(error.message);

      const clients = (data || []).map((item: any) => ({
        id: item.id,
        email: item.email,
        name: item.name,
        phone: item.phone,
        role: item.role,
        isOnline: Boolean(item.is_online),
        isBlocked: Boolean(item.is_blocked || item.blocked),
        createdAt: item.created_at,
      }));

      return { success: true, clients };
    } catch (error: any) {
      return { success: true, clients: [] };
    }
  }

  async getAdminMechanicList(search?: string) {
    try {
      let query = supabase.from('profiles').select('*').eq('role', 'provider');
      if (search && search.trim()) {
        const q = search.trim();
        query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,vehicle_model.ilike.%${q}%,vehicle_plate.ilike.%${q}%`);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error && !this.isMissingTableError(error)) throw new Error(error.message);

      const providerKeys = (data || []).map((item: any) => `user:${item.id}`);
      const kvMap: Record<string, any> = {};

      if (providerKeys.length > 0) {
        const { data: kvRows, error: kvError } = await supabase
          .from('kv_store_9dc5328a')
          .select('key, value, is_online, provider_location')
          .in('key', providerKeys);

        if (!kvError && kvRows) {
          for (const row of kvRows) {
            const parsedValue = row?.value && typeof row.value === 'object' ? row.value : {};
            kvMap[row.key.replace('user:', '')] = {
              ...parsedValue,
              is_online: row.is_online ?? parsedValue.is_online ?? parsedValue.isOnline ?? false,
              provider_location: row.provider_location ?? parsedValue.provider_location ?? parsedValue.providerLocation ?? null,
              status: parsedValue.status || (row.is_online ? 'available' : 'offline'),
            };
          }
        }
      }

      const mechanics = (data || []).map((item: any) => {
        const kvItem = kvMap[item.id] || {};
        const kvDebtValue = Number(kvItem.debt ?? kvItem.debt_amount ?? item.debt ?? item.debt_amount ?? 0) || 0;
        const debtValue = kvDebtValue || Number(item.debt ?? item.debt_amount ?? 0) || 0;
        const debtBlocked = this.isDebtOverdueForBlock({ ...item, value: kvItem, debt: debtValue, debt_amount: debtValue });
        const kvStatus = typeof kvItem.status === 'string' ? kvItem.status : null;
        const kvOnline = Boolean(kvItem.is_online ?? kvItem.isOnline ?? item.is_online ?? false);
        const kvBlocked = Boolean(
          kvItem.kv_blocked ??
          kvItem.is_blocked ??
          kvItem.isBlocked ??
          kvItem.blocked ??
          kvItem.blocked_reason ??
          kvItem.status === 'blocked' ??
          false
        );
        const forcedBlocked = Boolean(
          item.is_blocked ||
          item.blocked ||
          item.blocked_reason ||
          kvItem.kv_blocked ||
          kvItem.is_blocked ||
          kvItem.isBlocked ||
          kvItem.blocked ||
          kvItem.blocked_reason ||
          kvStatus === 'blocked' ||
          kvBlocked ||
          debtBlocked
        );

        return {
          id: item.id,
          email: item.email,
          name: item.name,
          phone: item.phone,
          role: item.role,
          status: forcedBlocked ? 'blocked' : (kvStatus || item.status || (kvOnline || item.is_online ? 'available' : 'offline')),
          isOnline: forcedBlocked ? false : (kvOnline || Boolean(item.is_online)),
          isBlocked: forcedBlocked,
          providerType: kvItem.providerType || item.provider_type,
          vehicleModel: kvItem.vehicleModel || item.vehicle_model,
          vehiclePlate: kvItem.vehiclePlate || item.vehicle_plate,
          documentType: kvItem.documentType || kvItem.document_type || item.document_type || null,
          documentUrl: kvItem.documentUrl || kvItem.document_url || item.document_url || null,
          debt: debtValue,
          createdAt: item.created_at,
        };
      });

      return { success: true, mechanics };
    } catch (error: any) {
      return { success: true, mechanics: [] };
    }
  }

  async getAllServiceRequests() {
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && !this.isMissingTableError(error)) throw new Error(error.message);

      const requests = (data || []).map((item: any) => ({
        id: item.id,
        customerId: item.customer_id,
        providerId: item.provider_id,
        customerName: item.customer_name || item.customerName || 'Cliente',
        customerPhone: item.customer_phone || item.customerPhone,
        providerName: item.provider_name || item.providerName || item.mechanic_name || item.mechanicName || 'Não atribuído',
        providerPhone: item.provider_phone || item.providerPhone,
        mechanicName: item.mechanic_name || item.mechanicName,
        type: item.type,
        description: item.description,
        location: item.location,
        providerLocation: item.provider_location || item.providerLocation,
        estimatedPrice: Number(item.estimated_price || item.estimatedPrice || 0),
        finalPrice: Number(item.final_price || item.finalPrice || 0),
        status: item.status,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));

      const { allowAll, ids } = await this.getCurrentAdminVisibilityScope();
      if (!allowAll && ids.size > 0) {
        return {
          success: true,
          requests: requests.filter((request: any) => {
            const customerId = request.customerId && String(request.customerId);
            const providerId = request.providerId && String(request.providerId);
            return (customerId && ids.has(customerId)) || (providerId && ids.has(providerId));
          }),
        };
      }

      return { success: true, requests };
    } catch (error: any) {
      return { success: true, requests: [] };
    }
  }

  async getUserContacts() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['provider', 'customer'])
        .order('created_at', { ascending: false });

      if (error && !this.isMissingTableError(error)) throw new Error(error.message);

      const { allowAll, ids, currentUserId } = await this.getCurrentAdminVisibilityScope();
      const contacts = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name || item.email || 'Usuário',
        email: item.email,
        phone: item.phone,
        role: item.role,
        providerType: item.provider_type,
        avatar: item.avatar,
        isOnline: Boolean(item.is_online),
      }));

      if (allowAll) return { success: true, contacts };

      const visible = contacts.filter((contact: any) => {
        if (!contact.id) return false;
        return ids.has(String(contact.id)) || (currentUserId && String(contact.id) === String(currentUserId));
      });

      return { success: true, contacts: visible };
    } catch (error: any) {
      return { success: true, contacts: [] };
    }
  }

  async getAdminNotifications() {
    try {
      const { data, error } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value')
        .like('key', 'notification:%')
        .order('key', { ascending: false });

      if (error && !this.isMissingTableError(error)) throw new Error(error.message);

      const notifications = (data || [])
        .map((row: any) => {
          const value = row.value && typeof row.value === 'object' ? row.value : null;
          if (!value || !value.title) return null;
          return {
            id: value.id || row.key,
            title: value.title,
            message: value.message,
            type: value.type || 'system',
            status: value.status || 'unread',
            created_at: value.created_at || value.createdAt,
            user_id: value.user_id || value.userId,
            payload: value.payload || {},
          };
        })
        .filter(Boolean);

      return { success: true, notifications };
    } catch (error: any) {
      return { success: true, notifications: [] };
    }
  }

  async getAllFaqs() {
    try {
      const { data, error } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value')
        .like('key', 'faq:%');

      if (error && !this.isMissingTableError(error)) throw new Error(error.message);

      const faqs = (data || [])
        .map((row: any) => {
          const value = row.value && typeof row.value === 'object' ? row.value : null;
          if (!value) return null;
          return {
            id: value.id || row.key,
            pergunta: value.pergunta || value.question || 'Pergunta',
            resposta: value.resposta || value.answer || '',
            ordem: Number(value.ordem || 0),
            ativa: value.ativa !== undefined ? Boolean(value.ativa) : true,
            created_at: value.created_at || new Date().toISOString(),
            updated_at: value.updated_at || value.created_at || new Date().toISOString(),
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => Number(a.ordem || 0) - Number(b.ordem || 0));

      if (faqs.length === 0) {
        for (const faq of DEFAULT_FAQS) {
          try {
            await supabase
              .from('kv_store_9dc5328a')
              .upsert({ key: `faq:${faq.id}`, value: faq, is_online: false });
          } catch (seedError: any) {
            console.warn('⚠️ Não foi possível criar FAQ padrão:', seedError?.message || seedError);
          }
        }

        return { success: true, faqs: DEFAULT_FAQS };
      }

      return { success: true, faqs };
    } catch (error: any) {
      console.warn('⚠️ Erro ao carregar FAQs. Usando conteúdo padrão:', error?.message || error);
      return { success: true, faqs: DEFAULT_FAQS };
    }
  }

  async getFaqList() {
    return this.getAllFaqs();
  }

  async createFaq(pergunta: string, resposta: string, ordem: number) {
    try {
      const faq = {
        id: `faq-${Date.now()}`,
        pergunta,
        resposta,
        ordem: Number(ordem || 0),
        ativa: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('kv_store_9dc5328a')
        .upsert({ key: `faq:${faq.id}`, value: faq, is_online: false });

      if (error && !this.isMissingTableError(error)) throw new Error(error.message);
      return { success: true, faq };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async updateFaq(faqId: string, pergunta?: string, resposta?: string, ordem?: number, ativa?: boolean) {
    try {
      const response = await this.getAllFaqs();
      const faq = (response.faqs || []).find((item: any) => item.id === faqId);
      const updated = {
        ...(faq || {}),
        id: faqId,
        pergunta: pergunta ?? faq?.pergunta ?? '',
        resposta: resposta ?? faq?.resposta ?? '',
        ordem: ordem !== undefined ? Number(ordem) : Number(faq?.ordem || 0),
        ativa: ativa !== undefined ? Boolean(ativa) : Boolean(faq?.ativa ?? true),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('kv_store_9dc5328a')
        .upsert({ key: `faq:${faqId}`, value: updated, is_online: false });

      if (error && !this.isMissingTableError(error)) throw new Error(error.message);
      return { success: true, faq: updated };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async deleteFaq(faqId: string) {
    try {
      const { error } = await supabase
        .from('kv_store_9dc5328a')
        .delete()
        .eq('key', `faq:${faqId}`);

      if (error && !this.isMissingTableError(error)) throw new Error(error.message);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async blockClient(userId: string) {
    try {
      const now = new Date().toISOString();
      const { data: kvRow, error: kvReadError } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value, is_online, provider_location')
        .eq('key', `user:${userId}`)
        .maybeSingle();

      const kvValue = kvRow?.value && typeof kvRow.value === 'object' ? kvRow.value : {};
      const mergedKvValue = {
        ...kvValue,
        id: userId,
        kv_blocked: true,
        isBlocked: true,
        is_blocked: true,
        blocked: true,
        blocked_reason: 'Bloqueado por administrador',
        blockedAt: now,
        blocked_at: now,
        status: 'blocked',
        isOnline: false,
        is_online: false,
      };

      // A tabela profiles não é a fonte de verdade do bloqueio no fluxo atual.
      // O bloqueio do mecânico deve persistir em kv_store_9dc5328a, que é o que
      // o painel admin/provider/leitura em tempo real usa.
      await this.upsertKvUserRow(
        userId,
        mergedKvValue,
        false,
        kvRow?.provider_location ?? kvValue.provider_location ?? kvValue.providerLocation ?? null,
      );

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async unblockClient(userId: string) {
    try {
      const now = new Date().toISOString();
      const { data: kvRow, error: kvReadError } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value, is_online, provider_location')
        .eq('key', `user:${userId}`)
        .maybeSingle();

      const kvValue = kvRow?.value && typeof kvRow.value === 'object' ? kvRow.value : {};
      if (this.isDebtOverdueForBlock({ value: kvValue })) {
        return {
          success: false,
          error: 'A dívida vencida só pode ser desbloqueada depois de o pagamento ser confirmado pelo administrador.',
        };
      }

      const mergedKvValue = {
        ...kvValue,
        id: userId,
        kv_blocked: false,
        isBlocked: false,
        is_blocked: false,
        blocked: false,
        blocked_reason: null,
        blockedAt: null,
        blocked_at: null,
        status: 'offline',
        isOnline: false,
        is_online: false,
        providerLocation: null,
        provider_location: null,
        location: null,
      };

      // Não tentamos mais atualizar o perfil no processo de desbloqueio.
      // O estado real e usado pelo app está em kv_store_9dc5328a.
      await this.upsertKvUserRow(
        userId,
        mergedKvValue,
        false,
        null,
      );

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getAllSupportTickets() {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('data_envio', { ascending: false });

      if (error && !this.isMissingTableError(error)) throw new Error(error.message);

      return { success: true, tickets: data || [] };
    } catch (error: any) {
      return { success: true, tickets: [] };
    }
  }

  async deleteSupportTicket(ticketId: string) {
    try {
      const normalizedId = String(ticketId).replace(/^support:/, '').trim();
      if (!normalizedId) {
        throw new Error('ID do ticket não informado.');
      }

      const { error } = await supabase
        .from('support_tickets')
        .delete()
        .eq('id', normalizedId);

      if (error && !this.isMissingTableError(error)) throw new Error(error.message);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao eliminar ticket:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteAllSupportTickets() {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .delete()
        .neq('id', '');

      if (error && !this.isMissingTableError(error)) throw new Error(error.message);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao eliminar todos os tickets:', error);
      return { success: false, error: error.message };
    }
  }

  async createSupportTicket(categoria: string, assunto: string, mensagem: string, cliente_id?: string) {
    try {
      const user = cliente_id || (await supabase.auth.getUser()).data.user?.id;
      if (!user) {
        throw new Error('Usuário não autenticado para criar ticket de suporte.');
      }

      const ticketId = `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const payload = {
        id: ticketId,
        cliente_id: user,
        categoria,
        assunto,
        mensagem,
        resposta_admin: null,
        status: 'Aberto',
        data_envio: new Date().toISOString(),
        data_resposta: null,
      };

      const { data, error } = await supabase
        .from('support_tickets')
        .insert(payload)
        .select('*')
        .single();

      if (error && !this.isMissingTableError(error)) throw new Error(error.message);
      return { success: true, ticket: data || payload };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getSupportTicketById(ticketId: string) {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', String(ticketId).replace(/^support:/, ''))
        .maybeSingle();

      if (error && !this.isMissingTableError(error)) throw new Error(error.message);
      return { success: true, ticket: data || null };
    } catch (error: any) {
      return { success: false, error: error.message, ticket: null };
    }
  }

  async respondToSupportTicket(ticketId: string, resposta_admin: string) {
    try {
      const ticketResponse = await supabase
        .from('support_tickets')
        .select('id, cliente_id, status, resposta_admin')
        .eq('id', String(ticketId).replace(/^support:/, ''))
        .maybeSingle();

      if (ticketResponse.error && !this.isMissingTableError(ticketResponse.error)) {
        throw new Error(ticketResponse.error.message);
      }

      const clientId = ticketResponse.data?.cliente_id;

      const { error } = await supabase
        .from('support_tickets')
        .update({
          resposta_admin,
          status: 'Respondido',
          data_resposta: new Date().toISOString(),
        })
        .eq('id', String(ticketId).replace(/^support:/, ''));

      if (error && !this.isMissingTableError(error)) throw new Error(error.message);

      if (clientId) {
        try {
          const user = await supabase.auth.getUser();
          const adminId = user.data.user?.id;
          if (adminId) {
            await supabase
              .from('messages')
              .insert({
                id: `msg-support-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                request_id: `support:${String(ticketId).replace(/^support:/, '')}`,
                sender_id: adminId,
                receiver_id: clientId,
                content: resposta_admin,
                is_read: false,
                created_at: new Date().toISOString(),
              });
          }
        } catch (messageError) {
          console.warn('⚠️ Não foi possível sincronizar resposta de ticket em messages:', messageError);
        }
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async updateSupportTicketStatus(ticketId: string, status: string) {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status, data_resposta: status === 'Respondido' ? new Date().toISOString() : null })
        .eq('id', ticketId);

      if (error && !this.isMissingTableError(error)) throw new Error(error.message);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async setRespondingFlag(kind: 'request' | 'user' | 'ticket', targetId: string) {
    try {
      const key = `responding:${kind}:${targetId}`;
      const { error } = await supabase
        .from('kv_store_9dc5328a')
        .upsert({
          key,
          value: {
            kind,
            targetId,
            updatedAt: new Date().toISOString(),
            isResponding: true,
          },
          is_online: true,
        });

      if (error && !this.isMissingTableError(error)) {
        throw new Error(error.message);
      }

      return { success: true, key };
    } catch (error: any) {
      console.warn('⚠️ Não foi possível marcar resposta ativa:', error.message);
      return { success: false, error: error.message };
    }
  }

  async clearRespondingFlag(kind: 'request' | 'user' | 'ticket', targetId: string) {
    try {
      const key = `responding:${kind}:${targetId}`;
      const { error } = await supabase
        .from('kv_store_9dc5328a')
        .delete()
        .eq('key', key);

      if (error && !this.isMissingTableError(error)) {
        throw new Error(error.message);
      }

      return { success: true, key };
    } catch (error: any) {
      console.warn('⚠️ Não foi possível limpar resposta ativa:', error.message);
      return { success: false, error: error.message };
    }
  }

  async updatePaymentReferenceStatus(requestId: string, status: string, note?: string, approved = false, amount?: number) {
    try {
      const normalizedRequestId = String(requestId || '').trim();
      const normalizedStatus = String(status || '').trim().toLowerCase();
      const key = `payment_ref:${normalizedRequestId}`;
      const isGeneratedReferenceId = /^(provider-payment-|profile-payment-|payment_ref:|payment-)/i.test(normalizedRequestId);
      const { data, error } = await supabase
        .from('kv_store_9dc5328a')
        .select('key, value')
        .eq('key', key)
        .maybeSingle();

      if (error && !this.isMissingTableError(error)) {
        throw new Error(error.message);
      }

      const currentValue = data?.value && typeof data.value === 'object' ? data.value : {};
      const shouldApplyDebtSettlement = approved || normalizedStatus === 'approved' || normalizedStatus === 'paid';
      const updatedAt = new Date().toISOString();
      const nextValue = {
        ...currentValue,
        status,
        note: note || currentValue.note || '',
        approved,
        amount: typeof amount === 'number' ? amount : Number(currentValue.amount || 0),
        confirmed_at: shouldApplyDebtSettlement ? currentValue.confirmed_at || updatedAt : currentValue.confirmed_at || null,
        updated_at: updatedAt,
        updatedAt,
      };

      const { error: upsertError } = await supabase
        .from('kv_store_9dc5328a')
        .upsert({ key, value: nextValue, is_online: false });

      if (upsertError && !this.isMissingTableError(upsertError)) {
        throw new Error(upsertError.message);
      }

      if (shouldApplyDebtSettlement) {
        let providerId: string | null = null;

        providerId =
          currentValue.userId ??
          currentValue.user_id ??
          currentValue.mechanicId ??
          currentValue.mechanic_id ??
          currentValue.providerId ??
          currentValue.provider_id ??
          null;

        if (!providerId && !isGeneratedReferenceId) {
          const { data: requestData, error: requestError } = await supabase
            .from('service_requests')
            .select('id, provider_id, providerId, mechanic_id, mechanicId')
            .eq('id', normalizedRequestId)
            .maybeSingle();

          if (requestError && !this.isMissingTableError(requestError)) {
            console.warn('⚠️ Não foi possível carregar o pedido para ajustar dívida:', requestError.message);
          }

          providerId = requestData?.provider_id ?? requestData?.providerId ?? requestData?.mechanic_id ?? requestData?.mechanicId ?? null;
        }

        if (!providerId && !isGeneratedReferenceId) {
          const { data: kvRequestData, error: kvRequestError } = await supabase
            .from('kv_store_9dc5328a')
            .select('key, value')
            .eq('key', `service:${normalizedRequestId}`)
            .maybeSingle();

          if (kvRequestError && !this.isMissingTableError(kvRequestError)) {
            console.warn('⚠️ Não foi possível carregar o pedido em KV para ajustar dívida:', kvRequestError.message);
          }

          const kvRequestValue = kvRequestData?.value && typeof kvRequestData.value === 'object' ? kvRequestData.value : {};
          providerId = kvRequestValue.provider_id ?? kvRequestValue.providerId ?? kvRequestValue.mechanic_id ?? kvRequestValue.mechanicId ?? null;
        }

        if (providerId) {
          const debtSnapshot = await this.getProviderDebt(providerId);
          if (!debtSnapshot.success) {
            throw new Error(debtSnapshot.error || 'Não foi possível consultar a dívida atual do mecânico.');
          }
          const currentDebt = Number(debtSnapshot?.debt ?? 0) || 0;
          const paidAmount = typeof amount === 'number' ? amount : Number(currentValue.amount || 0) || 0;
          const normalizedPaidAmount = Number.isFinite(paidAmount) ? Math.max(0, paidAmount) : 0;
          const nextDebt = normalizedPaidAmount > 0 ? Math.max(0, currentDebt - normalizedPaidAmount) : 0;
          const debtResult = await this.syncProviderDebt(
            providerId,
            nextDebt,
            nextDebt > 0 ? debtSnapshot.debtDueDate ?? new Date().toISOString() : null,
          );

          if (!debtResult.success) {
            console.warn('⚠️ Não foi possível ajustar a dívida do mecânico após confirmação:', debtResult.error);
          }
        }
      }

      return { success: true, reference: nextValue };
    } catch (error: any) {
      console.error('❌ Erro ao atualizar status da referência:', error);
      return { success: false, error: error.message };
    }
  }

  async approvePaymentReferencesMatchingAdminList(refs: string[]) {
    try {
      let approvedCount = 0;

      for (const reference of refs || []) {
        const cleanRef = String(reference || '').trim();
        if (!cleanRef) continue;

        const { data, error } = await supabase
          .from('kv_store_9dc5328a')
          .select('key, value')
          .like('key', 'payment_ref:%');

        if (error && !this.isMissingTableError(error)) {
          throw new Error(error.message);
        }

        const matched = (data || []).find((row: any) => {
          const value = row.value && typeof row.value === 'object' ? row.value : {};
          return String(value.reference || '').trim() === cleanRef;
        });

        if (matched) {
          const nextValue = { ...(matched.value || {}), status: 'approved', approved: true, updated_at: new Date().toISOString(), updatedAt: new Date().toISOString() };
          await supabase.from('kv_store_9dc5328a').upsert({ key: matched.key, value: nextValue, is_online: false });
          approvedCount += 1;
        }
      }

      return { success: true, approvedCount };
    } catch (error: any) {
      console.error('❌ Erro ao aprovar referências de pagamento:', error);
      throw error;
    }
  }

  async deletePaymentReference(requestId: string) {
    try {
      await supabase.from('kv_store_9dc5328a').delete().eq('key', `payment_ref:${requestId}`);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao excluir referência de pagamento:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteAllPaymentReferences() {
    try {
      const { error } = await supabase.from('kv_store_9dc5328a').delete().like('key', 'payment_ref:%');
      if (error && !this.isMissingTableError(error)) {
        throw new Error(error.message);
      }
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao excluir todas as referências de pagamento:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // CHAT METHODS
  // ============================================

  async sendMessage(requestId: string, receiverId: string, content: string) {
    try {
      console.log('🔐 Verificando autenticação para envio de mensagem...');
      const user = await supabase.auth.getUser();

      if (!user.data.user) {
        console.error('❌ Usuário não autenticado');
        throw new Error('Usuário não autenticado');
      }

      console.log('✅ Usuário autenticado:', user.data.user.id);

      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log('📝 Preparando mensagem:', {
        id: messageId,
        request_id: requestId,
        sender_id: user.data.user.id,
        receiver_id: receiverId,
        content: content.substring(0, 50) + (content.length > 50 ? '...' : '')
      });

      // Tentar inserção com campos explícitos
      const { data, error } = await supabase
        .from('messages')
        .insert({
          id: messageId,
          request_id: requestId,
          sender_id: user.data.user.id,
          receiver_id: receiverId,
          content: content,
          is_read: false,
          created_at: new Date().toISOString(),
        })
        .select('id, request_id, sender_id, receiver_id, content, is_read, created_at')
        .single();

      if (error) {
        console.error('❌ Erro na inserção:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });

        // Se for erro de RLS, tentar abordagem alternativa
        if (error.message.includes('violates row-level security policy') ||
            error.code === '42501' ||
            error.message.includes('policy')) {

          console.log('🔧 Detectado erro de RLS, tentando abordagem alternativa...');

          // Tentar usar uma session com service role (se disponível)
          // ou simplesmente informar o usuário sobre o problema
          throw new Error('Erro de segurança: As mensagens não podem ser enviadas devido a restrições de segurança. Entre em contato com o administrador.');
        }

        throw new Error(`Erro ao enviar mensagem: ${error.message}`);
      }

      console.log('✅ Mensagem enviada com sucesso:', data?.id);

      return {
        success: true,
        message: data
      };
    } catch (error: any) {
      console.error('❌ Erro geral ao enviar mensagem:', error);
      throw error;
    }
  }

  async getMessages(requestId: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar mensagens:', error.message);
        throw new Error(`Erro ao buscar mensagens: ${error.message}`);
      }

      console.log(`✅ ${data?.length || 0} mensagens recuperadas`);

      return {
        success: true,
        messages: data || []
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar mensagens:', error);
      throw error;
    }
  }

  async markMessageAsRead(messageId: string) {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId)
        .eq('receiver_id', user.data.user.id);

      if (error) {
        console.error('❌ Erro ao marcar mensagem como lida:', error.message);
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao marcar mensagem como lida:', error);
      return { success: false, error: error.message };
    }
  }

  async markMessagesAsRead(requestId: string) {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('request_id', requestId)
        .eq('receiver_id', user.data.user.id);

      if (error) {
        console.error('❌ Erro ao marcar mensagens como lidas:', error.message);
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteMessage(messageId: string) {
    try {
      if (!messageId) {
        throw new Error('ID da mensagem não informado.');
      }

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        console.error('❌ Erro ao apagar mensagem:', error.message);
        throw new Error(`Erro ao apagar mensagem: ${error.message}`);
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro geral ao apagar mensagem:', error);
      throw error;
    }
  }

  async deleteAllMessagesForUser(userId?: string) {
    try {
      const currentUserResult = userId ? { data: { user: { id: userId } } } : await supabase.auth.getUser();
      const currentUserId = currentUserResult?.data?.user?.id;

      if (!currentUserId) {
        throw new Error('Usuário não autenticado para remover mensagens.');
      }

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('receiver_id', currentUserId)
        .neq('sender_id', currentUserId);

      if (error) {
        console.error('❌ Erro ao apagar todas as mensagens:', error.message);
        throw new Error(`Erro ao apagar mensagens: ${error.message}`);
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro geral ao apagar todas as mensagens:', error);
      throw error;
    }
  }

  async getUnreadRequestIdsForUser(userId: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('request_id')
        .eq('receiver_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error('❌ Erro ao buscar mensagens não lidas:', error.message);
        return { success: false, requestIds: [] as string[] };
      }

      const requestIds = Array.from(new Set((data || []).map((item: any) => item.request_id)));
      return { success: true, requestIds };
    } catch (error: any) {
      console.error('❌ Erro ao buscar mensagens não lidas:', error);
      return { success: false, requestIds: [] as string[] };
    }
  }

  // ============================================
  // RATING METHODS
  // ============================================

  async createMechanicReview({
    mechanicId,
    rating,
    comment,
    serviceId,
    customerId,
  }: {
    mechanicId: string;
    rating: number;
    comment?: string | null;
    serviceId?: string | null;
    customerId?: string | null;
  }) {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error('Usuário não autenticado');
      }

      if (!mechanicId) {
        throw new Error('Mecânico não informado');
      }

      if (rating < 1 || rating > 5) {
        throw new Error('A avaliação deve estar entre 1 e 5');
      }

      const reviewPayload = {
        mechanic_id: mechanicId,
        customer_id: customerId || userData.user.id,
        rating,
        comment: comment || null,
        service_id: serviceId || null,
      };

      const { data, error } = await supabase
        .from('mechanic_reviews')
        .insert([reviewPayload])
        .select()
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao salvar avaliação do mecânico:', error.message);
        throw new Error(`Erro ao salvar avaliação: ${error.message}`);
      }

      return {
        success: true,
        review: data,
      };
    } catch (error: any) {
      console.error('❌ Erro ao criar avaliação do mecânico:', error);
      throw error;
    }
  }

  async getMechanicReviewsFromKV(mechanicId: string, limit = 6, offset = 0) {
    try {
      if (!mechanicId) {
        return { success: true, reviews: [] };
      }

      const { data, error } = await supabase
        .from('mechanic_reviews')
        .select('*')
        .eq('mechanic_id', mechanicId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('❌ Erro ao buscar avaliações do mecânico:', error.message);
        throw new Error(`Erro ao buscar avaliações: ${error.message}`);
      }

      return {
        success: true,
        reviews: data || [],
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar avaliações do mecânico:', error);
      throw error;
    }
  }

  async submitRating(requestId: string, ratedUserId: string, rating: number, comment?: string) {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('Usuário não autenticado');

      if (rating < 1 || rating > 5) {
        throw new Error('Rating deve estar entre 1 e 5');
      }

      const ratingId = `rating-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const { data, error } = await supabase
        .from('ratings')
        .insert([{
          id: ratingId,
          request_id: requestId,
          rater_id: user.data.user.id,
          rated_user_id: ratedUserId,
          rating: rating,
          comment: comment || null,
        }])
        .select()
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao enviar avaliação:', error.message);
        throw new Error(`Erro ao enviar avaliação: ${error.message}`);
      }

      // Atualizar rating médio do usuário
      const { data: ratings } = await supabase
        .from('ratings')
        .select('rating')
        .eq('rated_user_id', ratedUserId);

      if (ratings && ratings.length > 0) {
        const avgRating = ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length;
        
        await supabase
          .from('profiles')
          .update({
            rating: avgRating,
            total_reviews: ratings.length
          })
          .eq('id', ratedUserId);
      }

      console.log('✅ Avaliação enviada:', data?.id);

      return {
        success: true,
        rating: data
      };
    } catch (error: any) {
      console.error('❌ Erro ao enviar avaliação:', error);
      throw error;
    }
  }

  async getRatings(userId: string) {
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('rated_user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar avaliações:', error.message);
        throw new Error(`Erro ao buscar avaliações: ${error.message}`);
      }

      console.log(`✅ ${data?.length || 0} avaliações recuperadas`);

      return {
        success: true,
        ratings: data || []
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar avaliações:', error);
      throw error;
    }
  }

  async getMechanicRatingStats(mechanicId: string) {
    try {
      if (!mechanicId) {
        return { success: true, average: 0, total: 0 };
      }

      const { data, error } = await supabase
        .from('mechanic_reviews')
        .select('rating')
        .eq('mechanic_id', mechanicId);

      if (error && !this.isMissingTableError(error)) {
        console.error('❌ Erro ao buscar estatísticas de avaliação do mecânico:', error.message);
        throw new Error(`Erro ao buscar estatísticas de avaliação: ${error.message}`);
      }

      const reviews = data || [];
      const total = reviews.length;
      const average = total > 0
        ? reviews.reduce((sum: number, item: any) => sum + Number(item.rating || 0), 0) / total
        : 0;

      return {
        success: true,
        average: Number(average.toFixed(1)),
        total,
      };
    } catch (error: any) {
      console.warn('⚠️ Não foi possível carregar estatísticas do mecânico:', error?.message || error);
      return { success: false, average: 0, total: 0, error: error?.message || 'Erro ao carregar estatísticas do mecânico' };
    }
  }

  // ============================================
  // PROVIDER STATISTICS METHODS
  // ============================================

  async getTotalFinalizedPrice(providerId: string) {
    try {
      console.log('💵 Buscando total de preços finalizados do dia para:', providerId);

      const { data, error } = await supabase
        .from('finalizado')
        .select('final_price, finalized_at, created_at, updated_at')
        .eq('provider_id', providerId);

      if (error && !this.isMissingTableError(error)) {
        console.error('❌ Erro ao buscar preços finalizados:', error.message);
        throw new Error(`Erro ao buscar preços finalizados: ${error.message}`);
      }

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const totalPrice = (data || []).reduce((sum: number, item: any) => {
        const rawDate = item.finalized_at || item.created_at || item.updated_at;
        if (!rawDate) return sum;

        const itemDate = new Date(rawDate);
        if (Number.isNaN(itemDate.getTime())) return sum;
        if (itemDate >= startOfDay && itemDate <= endOfDay) {
          return sum + Number(item.final_price || 0);
        }

        return sum;
      }, 0);

      console.log(`✅ Total do dia de preços finalizados: ${totalPrice}`);

      return {
        success: true,
        totalPrice: totalPrice
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar total de preços finalizados do dia:', error);
      return { success: false, totalPrice: 0, error: error.message };
    }
  }

  async getTotalFinalizedCount(providerId: string) {
    try {
      console.log('📊 Buscando contagem de serviços finalizados do dia para:', providerId);

      const { data, error } = await supabase
        .from('finalizado')
        .select('final_price, finalized_at, created_at, updated_at')
        .eq('provider_id', providerId);

      if (error && !this.isMissingTableError(error)) {
        console.error('❌ Erro ao contar serviços finalizados:', error.message);
        throw new Error(`Erro ao contar serviços finalizados: ${error.message}`);
      }

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const totalCount = (data || []).filter((item: any) => {
        const rawDate = item.finalized_at || item.created_at || item.updated_at;
        if (!rawDate) return false;

        const itemDate = new Date(rawDate);
        if (Number.isNaN(itemDate.getTime())) return false;

        return itemDate >= startOfDay && itemDate <= endOfDay;
      }).length;

      console.log(`✅ Total do dia de serviços finalizados: ${totalCount}`);

      return {
        success: true,
        totalCount: totalCount
      };
    } catch (error: any) {
      console.error('❌ Erro ao contar serviços finalizados do dia:', error);
      return { success: false, totalCount: 0, error: error.message };
    }
  }

  // ============================================
  // DEBUG METHODS
  // ============================================

  async debugConnection() {
    try {
      console.log('🔍 Testando conexão com Supabase...');

      const { error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);

      if (error && !error.message.includes('relation "profiles" does not exist')) {
        console.error('❌ Erro na conexão:', error.message);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: 'Conexão com Supabase OK',
        hasProfilesTable: !error
      };
    } catch (error: any) {
      console.error('❌ Erro ao testar conexão:', error);
      return { success: false, error: error.message };
    }
  }
}

export const apiClient = new ApiClient();