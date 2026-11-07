import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 54321;

app.use(cors());
app.use(express.json());

// Mock data
let users = [
  {
    id: 'user-1',
    email: 'cliente@test.com',
    name: 'Cliente Teste',
    role: 'customer',
    phone: '+244 923 456 789'
  },
  {
    id: 'user-2',
    email: 'prestador@test.com',
    name: 'Prestador Teste',
    role: 'provider',
    phone: '+244 923 456 789',
    providerType: 'Troca de Pneu',
    vehicleModel: 'Toyota Hilux',
    vehiclePlate: 'ABC-1234'
  }
];

let serviceRequests = [];
let tokens = {};

// Auto-start server
console.log('🚀 Iniciando Mock Server...');
console.log(`📡 URL base: http://localhost:${PORT}/functions/v1/make-server-9dc5328a`);
console.log(`🌐 Também acessível via: http://192.168.0.115:${PORT}/functions/v1/make-server-9dc5328a`);
console.log('─'.repeat(80));

// Debug endpoints
app.get('/functions/v1/make-server-9dc5328a/debug/ping', (req, res) => {
  console.log('🔊 PING - Requisição recebida!');
  res.json({
    message: 'PONG - Mock server está vivo!',
    timestamp: new Date().toISOString()
  });
});

app.get('/functions/v1/make-server-9dc5328a/debug/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    users: users.length,
    requests: serviceRequests.length,
    tokens: Object.keys(tokens).length
  });
});

// Auth endpoints
app.post('/functions/v1/make-server-9dc5328a/auth/login', (req, res) => {
  const { email, password } = req.body;

  console.log(`🔐 Tentativa de login: ${email}`);

  const user = users.find(u => u.email === email);
  if (!user) {
    console.log(`❌ Usuário não encontrado: ${email}`);
    return res.status(400).json({ error: 'Usuário não encontrado' });
  }

  // Simular token
  const token = `mock_token_${Date.now()}_${user.id}`;
  tokens[token] = {
    userId: user.id,
    email: user.email,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };

  console.log(`✅ Login bem-sucedido para: ${user.name}`);

  res.json({
    success: true,
    user: user,
    accessToken: token,
    message: 'Login realizado com sucesso!'
  });
});

app.get('/functions/v1/make-server-9dc5328a/auth/session', (req, res) => {
  const token = req.headers['x-user-token'];
  if (!token || !tokens[token]) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  const tokenData = tokens[token];
  const user = users.find(u => u.id === tokenData.userId);

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  console.log(`🔍 Sessão verificada para: ${user.name}`);

  res.json({
    success: true,
    user: user,
    message: 'Sessão válida'
  });
});

app.post('/functions/v1/make-server-9dc5328a/auth/register', (req, res) => {
  const userData = req.body;

  console.log(`📝 Registrando novo usuário: ${userData.email}`);

  const newUser = {
    id: `user-${Date.now()}`,
    email: userData.email,
    name: userData.name,
    role: userData.role,
    phone: userData.phone || '+244 923 456 789',
    ...(userData.role === 'provider' && {
      providerType: userData.providerType || 'Serviço Geral',
      vehicleModel: userData.vehicleModel || 'Não informado',
      vehiclePlate: userData.vehiclePlate || 'Não informado'
    })
  };

  users.push(newUser);

  // Simular token
  const token = `mock_token_${Date.now()}_${newUser.id}`;
  tokens[token] = {
    userId: newUser.id,
    email: newUser.email,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };

  console.log(`✅ Usuário registrado: ${newUser.name}`);

  res.json({
    success: true,
    user: newUser,
    accessToken: token,
    message: 'Registro realizado com sucesso!'
  });
});

// Service endpoints
app.post('/functions/v1/make-server-9dc5328a/service/request', (req, res) => {
  const token = req.headers['x-user-token'];
  if (!token || !tokens[token]) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const requestData = req.body;
  const user = users.find(u => u.id === tokens[token].userId);

  console.log(`📡 Criando solicitação de serviço para: ${user.name}`);

  const newRequest = {
    id: `request-${Date.now()}`,
    userId: user.id,
    type: requestData.type,
    description: requestData.description,
    location: requestData.location,
    estimatedPrice: requestData.estimatedPrice,
    status: 'pending',
    createdAt: new Date().toISOString(),
    providerId: null // Será atribuído depois
  };

  serviceRequests.push(newRequest);

  console.log(`✅ Solicitação criada: ${newRequest.id}`);

  res.json({
    success: true,
    request: newRequest,
    message: 'Solicitação criada com sucesso!'
  });
});

app.get('/functions/v1/make-server-9dc5328a/service/:id', (req, res) => {
  const token = req.headers['x-user-token'];
  if (!token || !tokens[token]) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const requestId = req.params.id;
  const request = serviceRequests.find(r => r.id === requestId);

  if (!request) {
    return res.status(404).json({ error: 'Solicitação não encontrada' });
  }

  console.log(`📡 Buscando solicitação: ${requestId}`);

  res.json({
    success: true,
    request: request
  });
});

app.put('/functions/v1/make-server-9dc5328a/service/:id', (req, res) => {
  const token = req.headers['x-user-token'];
  if (!token || !tokens[token]) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const requestId = req.params.id;
  const request = serviceRequests.find(r => r.id === requestId);

  if (!request) {
    return res.status(404).json({ error: 'Solicitação não encontrada' });
  }

  const updates = req.body;
  Object.assign(request, updates);
  request.updatedAt = new Date().toISOString();

  console.log(`📝 Solicitação ${requestId} atualizada: status=${request.status}`);

  res.json({
    success: true,
    request: request,
    message: 'Solicitação atualizada com sucesso'
  });
});

app.get('/functions/v1/make-server-9dc5328a/service/pending/all', (req, res) => {
  console.log(`📋 Buscando todas as solicitações pendentes...`);

  const pendingRequests = serviceRequests.filter(r => r.status === 'pending');

  console.log(`✅ ${pendingRequests.length} solicitação(ões) pendente(s) encontrada(s)`);

  res.json({
    success: true,
    requests: pendingRequests,
    message: `${pendingRequests.length} solicitação(ões) disponível(is)`
  });
});

app.get('/functions/v1/make-server-9dc5328a/user/:id/services', (req, res) => {
  const token = req.headers['x-user-token'];
  if (!token || !tokens[token]) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const userId = req.params.id;
  const userRequests = serviceRequests.filter(r => r.userId === userId || r.providerId === userId);

  console.log(`📋 Buscando serviços do usuário ${userId}: ${userRequests.length} encontrado(s)`);

  res.json({
    success: true,
    requests: userRequests,
    message: `${userRequests.length} serviço(s) encontrado(s)`
  });
});

app.get('/functions/v1/make-server-9dc5328a/user/:id', (req, res) => {
  const token = req.headers['x-user-token'];
  if (!token || !tokens[token]) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const userId = req.params.id;
  const user = users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  console.log(`👤 Buscando dados do usuário: ${user.name}`);

  res.json({
    success: true,
    user: user
  });
});

// Provider endpoints
app.put('/functions/v1/make-server-9dc5328a/provider/status', (req, res) => {
  const token = req.headers['x-user-token'];
  if (!token || !tokens[token]) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const userId = tokens[token].userId;
  const user = users.find(u => u.id === userId);

  if (!user || user.role !== 'provider') {
    return res.status(403).json({ error: 'Usuário não é prestador' });
  }

  const { isOnline, location } = req.body;

  // Atualizar status do prestador
  user.online = isOnline;
  user.location = location;
  user.lastStatusUpdate = new Date().toISOString();

  console.log(`🟢 Status atualizado para ${user.name}: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
  if (location) {
    console.log(`📍 Localização: lat=${location.lat}, lng=${location.lng}`);
  }

  res.json({
    success: true,
    user: user,
    message: 'Status atualizado com sucesso'
  });
});

app.post('/functions/v1/make-server-9dc5328a/provider/nearby', (req, res) => {
  const { location, serviceType } = req.body;

  console.log(`🔍 Buscando prestadores próximos...`);
  if (serviceType) {
    console.log(`   Filtro: ${serviceType}`);
  }
  if (location) {
    console.log(`   Localização: lat=${location.lat}, lng=${location.lng}`);
  }

  // Buscar prestadores online
  let onlineProviders = users.filter(
    u => u.role === 'provider' && u.online === true
  );

  // Filtrar por tipo de serviço se fornecido
  if (serviceType) {
    onlineProviders = onlineProviders.filter(
      u => u.providerType?.toLowerCase().includes(serviceType.toLowerCase())
    );
  }

  console.log(`✅ ${onlineProviders.length} prestador(es) online encontrado(s)`);

  const providers = onlineProviders.map(provider => ({
    id: provider.id,
    name: provider.name,
    providerType: provider.providerType,
    vehicleModel: provider.vehicleModel,
    vehiclePlate: provider.vehiclePlate,
    location: provider.location || { lat: -8.8383, lng: 13.2344 },
    online: provider.online
  }));

  res.json({
    success: true,
    providers: providers,
    message: `${providers.length} prestador(es) encontrado(s)`
  });
});

// Middleware para logging (deve vir por último)
app.use((req, res, next) => {
  if (req.path.startsWith('/functions/v1/make-server-9dc5328a/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mock server rodando na porta ${PORT}`);
  console.log(`📡 URL base: http://localhost:54321/functions/v1/make-server-9dc5328a`);
  console.log(`🌐 Também acessível via: http://192.168.0.115:54321/functions/v1/make-server-9dc5328a`);
  console.log('');
  console.log('📋 Credenciais de teste:');
  console.log('Cliente: cliente@test.com / 123456');
  console.log('Prestador: prestador@test.com / 123456');
  console.log('');
  console.log('🔧 Endpoints disponíveis:');
  console.log('  Authentication:');
  console.log('    POST /auth/login');
  console.log('    POST /auth/register');
  console.log('    GET /auth/session');
  console.log('  Service Requests:');
  console.log('    POST /service/request');
  console.log('    GET /service/:id');
  console.log('    PUT /service/:id');
  console.log('    GET /service/pending/all');
  console.log('  Provider:');
  console.log('    PUT /provider/status');
  console.log('    POST /provider/nearby');
  console.log('  User:');
  console.log('    GET /user/:id');
  console.log('    GET /user/:id/services');
  console.log('  Debug:');
  console.log('    GET /debug/ping');
  console.log('    GET /debug/health');
});