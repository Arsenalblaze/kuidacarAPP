import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

// KuidaCar Server - v2.0 - Autenticação simplificada via KV store
const app = new Hono();

// Initialize Supabase client with service role (for admin operations)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Initialize Supabase client with anon key (for validating user tokens)
const supabaseAnon = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
);

// Expected Supabase table schema for persistent service requests:
// CREATE TABLE service_requests (
//   id TEXT PRIMARY KEY,
//   customer_id TEXT NOT NULL,
//   provider_id TEXT,
//   type TEXT NOT NULL,
//   description TEXT,
//   location JSONB,
//   estimated_price INTEGER,
//   status TEXT,
//   provider_location JSONB,
//   created_at TIMESTAMPTZ,
//   updated_at TIMESTAMPTZ
// );
const SERVICE_REQUESTS_TABLE = 'service_requests';

const isMissingTableError = (error: any) => {
  return (
    error?.code === '42P01' ||
    error?.message?.includes('does not exist') ||
    error?.message?.includes('relation')
  );
};

const normalizeServiceRequest = (service: any) => {
  if (!service) return service;
  return {
    ...service,
    customerId: service.customer_id ?? service.customerId,
    providerId: service.provider_id ?? service.providerId,
    estimatedPrice: service.estimated_price ?? service.estimatedPrice,
    createdAt: service.created_at ?? service.createdAt,
    updatedAt: service.updated_at ?? service.updatedAt,
    providerLocation: service.provider_location ?? service.providerLocation,
  };
};

const serviceRequestToDb = (service: any) => {
  if (!service) return service;

  const dbRow: any = {
    ...service,
    customer_id: service.customerId ?? service.customer_id,
    provider_id: service.providerId ?? service.provider_id,
    estimated_price: service.estimatedPrice ?? service.estimated_price,
    created_at: service.createdAt ?? service.created_at,
    updated_at: service.updatedAt ?? service.updated_at,
    provider_location: service.providerLocation ?? service.provider_location,
  };

  delete dbRow.customerId;
  delete dbRow.providerId;
  delete dbRow.estimatedPrice;
  delete dbRow.createdAt;
  delete dbRow.updatedAt;
  delete dbRow.providerLocation;

  return dbRow;
};

const normalizeUserProfile = (profile: any) => {
  if (!profile) return profile;
  return {
    ...profile,
    providerType: profile.provider_type ?? profile.providerType,
    vehicleModel: profile.vehicle_model ?? profile.vehicleModel,
    vehiclePlate: profile.vehicle_plate ?? profile.vehiclePlate,
    currentLocation: profile.location ?? profile.currentLocation,
    online: profile.online ?? profile.is_online ?? false,
    createdAt: profile.created_at ?? profile.createdAt,
    updatedAt: profile.updated_at ?? profile.updatedAt,
  };
};

const isProviderManuallyBlocked = (profile: any) => {
  const value = profile?.value && typeof profile.value === 'object' ? profile.value : profile;
  return Boolean(
    value?.kv_blocked ||
    value?.is_blocked ||
    value?.isBlocked ||
    value?.blocked ||
    value?.blocked_reason ||
    String(value?.status || '').toLowerCase() === 'blocked'
  );
};

const isProviderDebtOverdue = (profile: any) => {
  const value = profile?.value && typeof profile.value === 'object' ? profile.value : profile;
  const debt = Number(value?.debt ?? value?.debt_amount ?? 0) || 0;
  if (debt <= 0) return false;

  const dueDateValue = value?.debt_due_date ?? value?.debtDueDate ?? value?.created_at ?? value?.createdAt;
  if (!dueDateValue) return true;

  const dueDate = new Date(dueDateValue).getTime();
  return !Number.isFinite(dueDate) || Date.now() - dueDate >= 7 * 24 * 60 * 60 * 1000;
};

const isProviderBlockedForAvailability = (profile: any, kvProfile?: any) =>
  isProviderManuallyBlocked(profile) ||
  isProviderManuallyBlocked(kvProfile) ||
  isProviderDebtOverdue(profile) ||
  isProviderDebtOverdue(kvProfile);

const profileToDb = (profile: any) => {
  if (!profile) return profile;
  const dbRow: any = {
    ...profile,
    provider_type: profile.providerType ?? profile.provider_type,
    vehicle_model: profile.vehicleModel ?? profile.vehicle_model,
    vehicle_plate: profile.vehiclePlate ?? profile.vehicle_plate,
    location: profile.currentLocation ?? profile.location ?? null,
    is_online: profile.online ?? profile.isOnline ?? profile.is_online ?? false,
    created_at: profile.createdAt ?? profile.created_at,
    updated_at: profile.updatedAt ?? profile.updated_at,
  };

  delete dbRow.providerType;
  delete dbRow.vehicleModel;
  delete dbRow.vehiclePlate;
  delete dbRow.currentLocation;
  delete dbRow.createdAt;
  delete dbRow.updatedAt;
  delete dbRow.online;
  delete dbRow.isOnline;

  return dbRow;
};

const getUserProfileFromDb = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) {
        console.warn('⚠️ profiles table missing, fallback to KV store');
        return null;
      }
      throw error;
    }

    return normalizeUserProfile(data);
  } catch (error) {
    console.warn('⚠️ Unable to read permanent profile, using KV fallback:', error);
    return null;
  }
};

const upsertUserProfileToDb = async (profile: any) => {
  try {
    const dbRow = profileToDb(profile);
    const { error } = await supabase
      .from('profiles')
      .upsert(dbRow, { onConflict: 'id' });

    if (error) {
      if (isMissingTableError(error)) {
        console.warn('⚠️ profiles table missing, fallback to KV store');
        return false;
      }
      throw error;
    }

    return true;
  } catch (error) {
    console.warn('⚠️ Unable to write permanent profile, using KV only:', error);
    return false;
  }
};

const getUserProfile = async (userId: string) => {
  const profile = await getUserProfileFromDb(userId);
  if (profile) {
    return profile;
  }

  const kvProfile = await kv.get(`user:${userId}`);
  return normalizeUserProfile(kvProfile);
};

const setUserProfile = async (userId: string, profile: any) => {
  const dbSaved = await upsertUserProfileToDb({ id: userId, ...profile });
  await kv.set(`user:${userId}`, normalizeUserProfile(profile));
  return dbSaved;
};

// Helper function to validate user token from custom header
async function validateUserToken(c: any) {
  // O token do usuário vem no header X-User-Token
  const accessToken = c.req.header('X-User-Token');

  console.log('🔍 Validando token:', accessToken ? accessToken.substring(0, 30) + '...' : 'AUSENTE');

  if (!accessToken) {
    console.error('❌ Token não fornecido no header X-User-Token');
    return { user: null, error: new Error('Token não fornecido') };
  }

  try {
    // Validar usando KV store (método simplificado e confiável)
    console.log('📦 Buscando token no KV store...');
    const tokenData = await kv.get(`token:${accessToken}`);

    console.log('📊 Resultado KV:', tokenData ? `ENCONTRADO (user: ${tokenData.userId})` : 'NÃO ENCONTRADO');

    if (tokenData && tokenData.userId) {
      // Verificar se o token expirou
      const expiresAt = new Date(tokenData.expiresAt).getTime();
      const now = Date.now();
      console.log('⏰ Verificando expiração:', { expiresAt, now, expired: now > expiresAt });

      if (now > expiresAt) {
        console.log('⏰ Token expirado, removendo...');
        await kv.del(`token:${accessToken}`);
        return { user: null, error: new Error('Token expirado') };
      }

      console.log('✅ Token válido! UserID:', tokenData.userId);
      // Retornar um objeto user com o ID
      return {
        user: { id: tokenData.userId, email: tokenData.email },
        error: null
      };
    }

    console.error('❌ Token não encontrado ou inválido no KV store');
    return { user: null, error: new Error('Token inválido') };
  } catch (err) {
    console.error('❌ Erro durante validação:', err);
    return { user: null, error: err };
  }
}

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-User-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/health", (c) => {
  console.log('🏥 HEALTH CHECK - Requisição recebida!');
  console.log('Method:', c.req.method);
  console.log('Headers:', Object.fromEntries(c.req.raw.headers));
  return c.json({ 
    status: "ok", 
    version: "2.0-kv-auth",
    timestamp: new Date().toISOString(),
    message: "✅ Servidor respondendo normalmente"
  });
});

// Debug endpoint - teste simples
app.get("/debug/ping", (c) => {
  console.log('🔊 PING - Requisição recebida!');
  return c.json({ 
    message: "PONG - Servidor está vivo!",
    timestamp: new Date().toISOString(),
  });
});

// Debug endpoint - teste com POST
app.post("/debug/echo", async (c) => {
  try {
    console.log('📢 ECHO - Requisição POST recebida!');
    console.log('Headers:', Object.fromEntries(c.req.raw.headers));
    
    const body = await c.req.json();
    console.log('Body recebido:', body);
    
    return c.json({ 
      received: body,
      timestamp: new Date().toISOString(),
      message: "✅ Echo funcionando!"
    });
  } catch (error) {
    console.error('❌ Erro no echo:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Debug endpoint - verificar tokens no KV
app.get("/debug/tokens", async (c) => {
  try {
    const allTokens = await kv.getByPrefix('token:');
    const tokenCount = allTokens.length;

    console.log(`📊 Total de tokens no KV: ${tokenCount}`);

    return c.json({
      count: tokenCount,
      tokens: allTokens.map((t: any) => ({
        userId: t.userId,
        email: t.email,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
        expired: new Date(t.expiresAt).getTime() < Date.now()
      }))
    });
  } catch (error: any) {
    console.error('❌ Erro no debug de tokens:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Debug endpoint - verificar headers recebidos
app.get("/debug/headers", async (c) => {
  try {
    const headers = {
      authorization: c.req.header('Authorization'),
      userToken: c.req.header('X-User-Token'),
      contentType: c.req.header('Content-Type'),
      allHeaders: Object.fromEntries(c.req.raw.headers.entries())
    };

    console.log('🔍 Headers recebidos:', headers);

    return c.json({
      success: true,
      headers,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Erro no debug de headers:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Secure RPC endpoint to get mechanic rating stats
app.get('/rpc/mechanic-stats/:id', async (c) => {
  try {
    const mechId = c.req.param('id');
    if (!mechId) return c.json({ error: 'mechanic id required' }, 400);

    // Validate user token (from X-User-Token header)
    const { user, error: tokenErr } = await validateUserToken(c);
    if (tokenErr || !user) {
      console.warn('Autenticação falhou ao acessar rpc/mechanic-stats:', tokenErr);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Use service-role supabase client to call server RPC for stats
    const { data, error } = await supabase.rpc('get_mechanic_rating_stats', { mech_id: mechId });
    if (error) {
      console.error('Erro ao rodar RPC get_mechanic_rating_stats:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true, stats: Array.isArray(data) && data.length > 0 ? data[0] : data || null });
  } catch (err: any) {
    console.error('Erro no endpoint /rpc/mechanic-stats/:id', err);
    return c.json({ error: err?.message || 'Internal error' }, 500);
  }
});

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Register new user (customer or provider)
app.post("/auth/register", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, password, phone, role, providerType, vehicleModel, vehiclePlate } = body;

    console.log('📝 Tentativa de registro:', { email, role });

    // Check if email already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(user => user.email === email);
    
    if (emailExists) {
      console.log('❌ Email já cadastrado:', email);
      return c.json({ error: 'Email já cadastrado. Faça login.' }, 400);
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since email server not configured
      user_metadata: { name, role },
    });

    if (authError) {
      console.error("❌ Erro ao criar usuário:", authError.message);
      return c.json({ error: `Erro ao criar usuário: ${authError.message}` }, 400);
    }

    console.log('✅ Usuário criado no Auth:', authData.user.id);

    // Store user profile in KV store
    const userProfile = {
      id: authData.user.id,
      name,
      email,
      phone,
      role,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
      createdAt: new Date().toISOString(),
      ...(role === "provider" && {
        providerType,
        vehicleModel,
        vehiclePlate,
        rating: 0,
        completedServices: 0,
        isOnline: false,
      }),
    };

    await kv.set(`user:${authData.user.id}`, userProfile);

    const profileRow = {
      id: authData.user.id,
      email,
      avatar: userProfile.avatar,
      name,
      phone,
      role,
      provider_type: providerType || null,
      vehicle_model: vehicleModel || null,
      vehicle_plate: vehiclePlate || null,
      online: false,
      location: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .insert([profileRow]);

    if (profileError && !isMissingTableError(profileError)) {
      console.warn('⚠️ Falha ao salvar perfil permanente, continuando com KV:', profileError.message);
    }

    console.log('✅ Registro completo para:', name);

    return c.json({ 
      success: true, 
      user: userProfile,
      message: "Usuário registrado com sucesso!" 
    });
  } catch (error) {
    console.error("❌ Erro no registro (catch):", error);
    return c.json({ error: `Erro no registro: ${error.message}` }, 500);
  }
});

// Login user
app.post("/auth/login", async (c) => {
  try {
    console.log('🔐 Tentativa de login recebida');
    
    const body = await c.req.json();
    const { email, password } = body;

    console.log('📧 Email:', email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("❌ Erro no login Supabase:", error.message);
      return c.json({ error: `Erro no login: ${error.message}` }, 400);
    }

    console.log('✅ Autenticação Supabase OK, user ID:', data.user.id);

    // Get user profile from Supabase profiles table or KV store fallback
    const userProfile = await getUserProfile(data.user.id);

    if (!userProfile) {
      console.error('❌ Perfil não encontrado para user:', data.user.id);
      return c.json({ error: "Perfil do usuário não encontrado" }, 404);
    }

    await kv.set(`user:${data.user.id}`, normalizeUserProfile(userProfile));

    console.log('✅ Login completo para:', userProfile.name);

    // Armazenar o token do Supabase no KV para validação futura
    // (enquanto supabaseAnon.auth.getUser() não funciona corretamente)
    const supabaseToken = data.session.access_token;

    await kv.set(`token:${supabaseToken}`, {
      userId: data.user.id,
      email: data.user.email,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
    });

    console.log('🔑 Token Supabase armazenado no KV:', supabaseToken.substring(0, 30) + '...');

    return c.json({
      success: true,
      user: userProfile,
      accessToken: supabaseToken,
      message: "Login realizado com sucesso!"
    });
  } catch (error) {
    console.error("❌ Login error (catch):", error);
    return c.json({ error: `Erro no login: ${error.message}` }, 500);
  }
});

// Get current user session
app.get("/auth/session", async (c) => {
  try {
    const { user, error } = await validateUserToken(c);

    if (error || !user) {
      return c.json({ error: "Sessão inválida" }, 401);
    }

    const userProfile = await getUserProfile(user.id);

    if (!userProfile) {
      return c.json({ error: "Perfil do usuário não encontrado" }, 404);
    }

    await kv.set(`user:${user.id}`, normalizeUserProfile(userProfile));
    return c.json({ success: true, user: userProfile });
  } catch (error) {
    console.error("Session error:", error);
    return c.json({ error: `Erro na sessão: ${error.message}` }, 500);
  }
});

// ============================================
// USER PROFILE ROUTES
// ============================================

// Update user profile
app.put("/user/profile", async (c) => {
  try {
    const { user, error } = await validateUserToken(c);

    if (error || !user) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const body = await c.req.json();
    const currentProfile = await getUserProfile(user.id);

    const updatedProfile = {
      ...currentProfile,
      ...body,
      id: user.id, // Preserve ID
      email: currentProfile.email, // Email cannot be changed
      updatedAt: new Date().toISOString(),
    };

    await setUserProfile(user.id, updatedProfile);

    return c.json({ success: true, user: updatedProfile });
  } catch (error) {
    console.error("Profile update error:", error);
    return c.json({ error: `Erro ao atualizar perfil: ${error.message}` }, 500);
  }
});

// Get user profile by ID
app.get("/user/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const userProfile = await getUserProfile(userId);

    if (!userProfile) {
      return c.json({ error: "Usuário não encontrado" }, 404);
    }

    return c.json({ success: true, user: userProfile });
  } catch (error) {
    console.error("Get user error:", error);
    return c.json({ error: `Erro ao buscar usuário: ${error.message}` }, 500);
  }
});

// ============================================
// SERVICE REQUEST ROUTES
// ============================================

// Create service request
app.post("/service/request", async (c) => {
  try {
    console.log('🔐 Headers:', {
      auth: c.req.header('Authorization')?.substring(0, 30),
      userToken: c.req.header('X-User-Token')?.substring(0, 30)
    });

    // Validar token usando helper function
    const { user, error } = await validateUserToken(c);

    if (error || !user) {
      console.error('❌ Erro ao validar token:', error?.message);
      return c.json({ error: "Não autorizado" }, 401);
    }

    console.log('✅ Usuário autenticado:', user.id);

    const body = await c.req.json();
    const requestId = `req_${Date.now()}`;

    const serviceRequest = {
      id: requestId,
      customerId: user.id,
      providerId: body.providerId ?? null,
      type: body.type,
      description: body.description,
      location: body.location,
      estimatedPrice: body.estimatedPrice,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const serviceRequestRow = serviceRequestToDb({
      ...serviceRequest,
      customerId: user.id,
      providerId: body.providerId ?? null,
      estimatedPrice: body.estimatedPrice,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    let persistedRequest = serviceRequest;

    const { data: insertedService, error: insertError } = await supabase
      .from(SERVICE_REQUESTS_TABLE)
      .insert([serviceRequestRow])
      .select()
      .single();

    if (insertError) {
      console.warn('⚠️ Erro ao salvar service request na tabela:', insertError.message);
      if (!isMissingTableError(insertError)) {
        throw insertError;
      }
      console.log('⚠️ Tabela service_requests não encontrada, salvando em KV store como fallback.');
      await kv.set(`service:${requestId}`, serviceRequest);
    } else {
      persistedRequest = normalizeServiceRequest(insertedService);
      await kv.set(`service:${requestId}`, persistedRequest);
    }

    console.log('✅ Solicitação criada:', requestId);

    return c.json({ 
      success: true, 
      request: persistedRequest,
      message: "Solicitação criada com sucesso!" 
    });
  } catch (error: any) {
    console.error("Service request error:", error);
    return c.json({ error: `Erro ao criar solicitação: ${error.message}` }, 500);
  }
});

// Get service request by ID
app.get("/service/:requestId", async (c) => {
  try {
    const requestId = c.req.param('requestId');
    let serviceRequest: any = null;

    const { data, error } = await supabase
      .from(SERVICE_REQUESTS_TABLE)
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (!error) {
      serviceRequest = normalizeServiceRequest(data);
    } else if (isMissingTableError(error)) {
      console.warn('⚠️ service_requests table missing, falling back to KV for get service request');
    } else {
      throw error;
    }

    if (!serviceRequest) {
      serviceRequest = await kv.get(`service:${requestId}`);
    }

    if (!serviceRequest) {
      return c.json({ error: "Solicitação não encontrada" }, 404);
    }

    return c.json({ success: true, request: serviceRequest });
  } catch (error: any) {
    console.error("Get service error:", error);
    return c.json({ error: `Erro ao buscar solicitação: ${error.message}` }, 500);
  }
});

// Update service request (accept, complete, cancel)
app.put("/service/:requestId", async (c) => {
  try {
    const { user, error } = await validateUserToken(c);

    if (error || !user) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const requestId = c.req.param('requestId');
    const body = await c.req.json();
    
    let currentRequest: any = null;
    let serviceTableAvailable = false;

    const { data: serviceRow, error: selectError } = await supabase
      .from(SERVICE_REQUESTS_TABLE)
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (!selectError) {
      currentRequest = normalizeServiceRequest(serviceRow);
      serviceTableAvailable = true;
    } else if (isMissingTableError(selectError)) {
      console.warn('⚠️ service_requests table missing, falling back to KV for update');
    } else {
      throw selectError;
    }

    if (!currentRequest) {
      currentRequest = await kv.get(`service:${requestId}`);
    }

    if (!currentRequest) {
      return c.json({ error: "Solicitação não encontrada" }, 404);
    }

    const updatedRequest = {
      ...currentRequest,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    if (serviceTableAvailable) {
      const updatedRequestRow = serviceRequestToDb({
        ...updatedRequest,
        updatedAt: new Date().toISOString(),
      });

      const { error: updateError } = await supabase
        .from(SERVICE_REQUESTS_TABLE)
        .update(updatedRequestRow)
        .eq('id', requestId);

      if (updateError && !isMissingTableError(updateError)) {
        throw updateError;
      }
    }

    await kv.set(`service:${requestId}`, updatedRequest);

    return c.json({ success: true, request: updatedRequest });
  } catch (error: any) {
    console.error("Update service error:", error);
    return c.json({ error: `Erro ao atualizar solicitação: ${error.message}` }, 500);
  }
});

// Get all service requests for a user
app.get("/user/:userId/services", async (c) => {
  try {
    const userId = c.req.param('userId');
    let userServices: any[] = [];

    const { data, error } = await supabase
      .from(SERVICE_REQUESTS_TABLE)
      .select('*')
      .or(`customer_id.eq.${userId},provider_id.eq.${userId}`);

    if (!error) {
      userServices = (data || []).map(normalizeServiceRequest);
    } else if (isMissingTableError(error)) {
      console.warn('⚠️ service_requests table missing, falling back to KV for get user services');
      const allServices = await kv.getByPrefix('service:');
      userServices = allServices.filter(
        (service: any) => service.customerId === userId || service.providerId === userId
      );
    } else {
      throw error;
    }

    return c.json({ success: true, services: userServices });
  } catch (error: any) {
    console.error("Get user services error:", error);
    return c.json({ error: `Erro ao buscar serviços: ${error.message}` }, 500);
  }
});

// Get pending service requests for providers
app.get("/service/pending/all", async (c) => {
  try {
    console.log('📋 Buscando solicitações pendentes...');
    
    let pendingServices: any[] = [];
    const { data, error } = await supabase
      .from(SERVICE_REQUESTS_TABLE)
      .select('*')
      .eq('status', 'pending');

    if (!error) {
      pendingServices = (data || []).map(normalizeServiceRequest);
    } else if (isMissingTableError(error)) {
      console.warn('⚠️ service_requests table missing, falling back to KV for pending services');
      const allServices = await kv.getByPrefix('service:');
      pendingServices = allServices.filter((service: any) => service.status === 'pending');
    } else {
      throw error;
    }

    console.log(`📊 Total de solicitações pendentes: ${pendingServices.length}`);

    return c.json({ success: true, requests: pendingServices });
  } catch (error: any) {
    console.error("Get pending services error:", error);
    return c.json({ error: `Erro ao buscar solicitações pendentes: ${error.message}` }, 500);
  }
});

// ============================================
// PROVIDER ROUTES
// ============================================

// Update provider online status
app.put("/provider/status", async (c) => {
  try {
    const { user, error } = await validateUserToken(c);

    if (error || !user) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const body = await c.req.json();
    const currentProfile = await getUserProfile(user.id);
    const kvProfile = await kv.get(`user:${user.id}`);

    if (currentProfile.role !== 'provider') {
      return c.json({ error: "Usuário não é prestador" }, 403);
    }

    const isBlocked = isProviderBlockedForAvailability(currentProfile, kvProfile);
    const profileForUpdate = {
      ...currentProfile,
      kv_blocked: Boolean(currentProfile.kv_blocked || kvProfile?.kv_blocked),
      is_blocked: Boolean(currentProfile.is_blocked || currentProfile.isBlocked || kvProfile?.is_blocked || kvProfile?.isBlocked),
      isBlocked: Boolean(currentProfile.isBlocked || currentProfile.is_blocked || kvProfile?.isBlocked || kvProfile?.is_blocked),
      blocked: Boolean(currentProfile.blocked || kvProfile?.blocked),
      blocked_reason: kvProfile?.blocked_reason || currentProfile.blocked_reason || null,
      debt: currentProfile.debt ?? kvProfile?.debt,
      debt_amount: currentProfile.debt_amount ?? kvProfile?.debt_amount,
      debt_due_date: currentProfile.debt_due_date ?? kvProfile?.debt_due_date,
      debtDueDate: currentProfile.debtDueDate ?? kvProfile?.debtDueDate,
    };
    if (body.isOnline && isBlocked) {
      const offlineProfile = {
        ...profileForUpdate,
        online: false,
        is_online: false,
        isOnline: false,
        location: null,
        currentLocation: null,
        providerLocation: null,
        provider_location: null,
        status: isProviderManuallyBlocked(kvProfile) || isProviderManuallyBlocked(currentProfile)
          ? 'blocked'
          : 'offline',
      };
      await setUserProfile(user.id, offlineProfile);
      return c.json({
        success: false,
        error: "A conta está bloqueada ou suspensa por dívida. Regularize a situação e aguarde a confirmação do administrador.",
      }, 403);
    }

    const updatedProfile = {
      ...profileForUpdate,
      online: body.isOnline,
      is_online: body.isOnline,
      isOnline: body.isOnline,
      location: body.isOnline ? body.location ?? currentProfile.location : null,
      currentLocation: body.isOnline ? body.location ?? currentProfile.location : null,
      providerLocation: body.isOnline ? body.location ?? currentProfile.location : null,
      provider_location: body.isOnline ? body.location ?? currentProfile.location : null,
      status: body.isOnline
        ? 'available'
        : isBlocked && isProviderManuallyBlocked(profileForUpdate) ? 'blocked' : 'offline',
      updatedAt: new Date().toISOString(),
    };

    await setUserProfile(user.id, updatedProfile);

    return c.json({ success: true, user: updatedProfile });
  } catch (error) {
    console.error("Provider status error:", error);
    return c.json({ error: `Erro ao atualizar status: ${error.message}` }, 500);
  }
});

// Get online providers nearby
app.post("/provider/nearby", async (c) => {
  try {
    const body = await c.req.json();
    const { location, serviceType } = body;

    const { data: providers, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'provider')
      .eq('is_online', true);

    let onlineProviders: any[] = [];
    const userValues = await kv.getByPrefix('user:');
    const kvByUserId = new Map<string, any>(
      (userValues || [])
        .filter((user: any) => user?.id)
        .map((user: any) => [String(user.id), user])
    );

    if (error && !isMissingTableError(error)) {
      throw error;
    }

    if (providers) {
      onlineProviders = providers.filter(
        (provider: any) => !isProviderBlockedForAvailability(provider, kvByUserId.get(String(provider.id)))
      );
    } else {
      // Fallback to KV if the profiles table does not exist.
      onlineProviders = userValues.filter(
        (provider: any) =>
          provider.role === 'provider' &&
          (provider.isOnline || provider.is_online) &&
          !isProviderBlockedForAvailability(provider)
      );
    }

    const matchedProviders = onlineProviders
      .map(normalizeUserProfile)
      .filter((provider: any) => {
        if (!serviceType) return true;
        return provider.providerType?.toLowerCase().includes(serviceType.toLowerCase());
      })
      .map((provider: any) => ({
        id: provider.id,
        name: provider.name,
        providerType: provider.providerType,
        vehicleModel: provider.vehicleModel,
        vehiclePlate: provider.vehiclePlate,
        location: provider.currentLocation || provider.location,
        online: provider.online,
      }));

    return c.json({ success: true, providers: matchedProviders });
  } catch (error) {
    console.error("Get nearby providers error:", error);
    return c.json({ error: `Erro ao buscar prestadores: ${error.message}` }, 500);
  }
});

// ============================================
// RATING ROUTES
// ============================================

// Submit rating for service
app.post("/rating", async (c) => {
  try {
    const { user, error } = await validateUserToken(c);

    if (error || !user) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const body = await c.req.json();
    const { serviceId, providerId, rating, comment } = body;

    const ratingData = {
      id: `rating_${Date.now()}`,
      serviceId,
      customerId: user.id,
      providerId,
      rating,
      comment,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`rating:${ratingData.id}`, ratingData);

    // Update provider rating
    const provider = await kv.get(`user:${providerId}`);
    const allRatings = await kv.getByPrefix(`rating:`);
    const providerRatings = allRatings.filter((r: any) => r.providerId === providerId);
    
    const avgRating = providerRatings.reduce((sum: number, r: any) => sum + r.rating, 0) / providerRatings.length;

    await kv.set(`user:${providerId}`, {
      ...provider,
      rating: avgRating,
    });

    return c.json({ 
      success: true, 
      rating: ratingData,
      message: "Avaliação enviada com sucesso!" 
    });
  } catch (error) {
    console.error("Rating error:", error);
    return c.json({ error: `Erro ao enviar avaliação: ${error.message}` }, 500);
  }
});

Deno.serve(app.fetch);