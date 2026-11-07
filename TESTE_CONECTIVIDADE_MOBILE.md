# Teste de Conectividade - App Mobile

## 🔍 Problema Identificado

O app estava usando **axios** em React Native, que pode ter problemas de compatibilidade. Agora está usando **fetch nativo** (mais confiável).

## 🎯 Mudanças Realizadas

### 1. **Cliente API Atualizado**
- ✅ Trocado `axios` por `fetch` nativo
- ✅ Headers corretos (Authorization + X-User-Token)
- ✅ Tratamento aprimorado de erros
- ✅ Detecção de erro de rede mais robusta

### 2. **Como Testar**

#### Teste 1: Verificar se consegue fazer login
```
1. Abra o app mobile
2. Na tela de Login, use:
   - Email: cliente@test.com
   - Senha: 123456
3. Clique em "Entrar"
```

**Esperado**: 
- ✅ Login realizado com sucesso
- ✅ Direcionado para a Home

**Se der erro**:
- Verifique os logs do console (Metro/Expo)
- Procure por mensagens como:
  - "🔐 [Mobile API] Iniciando login"
  - "🌐 [Mobile API] Fazendo fetch nativo"
  - "📊 Status: 200" (sucesso) ou outro número

#### Teste 2: Criar uma solicitação de serviço
```
1. Após login, navegue para "Services"
2. Clique em "Solicitar Assistência"
3. Selecione um serviço (ex: "Troca de Pneu")
4. Digite um endereço
5. Clique em "Solicitar Assistência"
```

**Esperado**:
- ✅ Alerta: "✅ Solicitação criada! Buscando prestadores..."
- ✅ Redirecionamento para acompanhamento

**Se der erro de conectividade**:
- Verifique se o token está sendo enviado (logs com 🔑)
- Confirme se Supabase está respondendo (testa na seção abaixo)

#### Teste 3: Verificar logs
Abra o Expo Metro (terminal) e procure por:

```
✅ [Mobile API] Requisições bem-sucedidas mostram:
- 📡 [Mobile API] Request para /auth/login
- 🌐 [Mobile API] Fazendo fetch nativo
- 📊 Status: 200
- ✅ Sucesso em /auth/login

❌ [Mobile API] Requisições com erro mostram:
- 📡 [Mobile API] Request para /service/request
- 🌐 [Mobile API] Fazendo fetch nativo
- 📊 Status: 401 (Não Autorizado) ou 500 (Erro do servidor)
- ❌ Erro na requisição
```

## 🌐 Testar Supabase Manualmente

Se quiser testar a conectividade do Supabase direto:

```powershell
# Teste 1: Health Check
Invoke-WebRequest -Uri 'https://befxsozetzwgouurhduy.supabase.co/functions/v1/make-server-9dc5328a/health' `
  -Method GET `
  -Headers @{'Authorization'='Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZnhzb3pldHp3Z291dXJoZHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTQ1OTEsImV4cCI6MjA4OTk3MDU5MX0.FtTiIXKO-AS1Bm93aIpan0pbOfSWCLpW1sZ0ri36sgM'}

# Esperado: StatusCode : 200, Content : {"status":"ok"}

# Teste 2: Fazer Login
$loginBody = @{
    email = 'cliente@test.com'
    password = '123456'
} | ConvertTo-Json

Invoke-WebRequest -Uri 'https://befxsozetzwgouurhduy.supabase.co/functions/v1/make-server-9dc5328a/auth/login' `
  -Method POST `
  -Headers @{
    'Content-Type'='application/json'
    'Authorization'='Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZnhzb3pldHp3Z291dXJoZHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTQ1OTEsImV4cCI6MjA4OTk3MDU5MX0.FtTiIXKO-AS1Bm93aIpan0pbOfSWCLpW1sZ0ri36sgM'
  } `
  -Body $loginBody

# Esperado: StatusCode : 200, Content com accessToken
```

## 📝 Correções Aplicadas

### Antes (❌ Problema)
```typescript
import axios from 'axios';
const response = await axios({
  method: 'POST',
  url,
  headers,
  data: options.body,
});
// ❌ axios em React Native pode ter comportamento inconsistente
```

### Depois (✅ Corrigido)
```typescript
const response = await fetch(url, {
  method,
  headers,
  body,
});
// ✅ fetch nativo é mais confiável em React Native
```

## 🚀 Próximas Etapas

1. **Teste o app mobile agora**
2. **Verifique os logs** procurando por mensagens com emojis (🔐, 📡, 🌐, 📊, ✅, ❌)
3. **Se ainda der erro**, nos envie os logs exatos que aparecem no Expo Metro
4. **Verifique a conectividade** de internet do seu device/emulador

## 💡 Dicas de Debug

Se não conseguir conectar:

1. **Verifique a internet**: Tente acessar um site normal (Google, etc)
2. **Verifique o firewall**: Algumas redes corporativas bloqueiam requisições
3. **Tente com VPN**: Se estiver em uma rede restrita
4. **Reinicie o Expo**: `npm start -- --reset-cache`
5. **Limpe o cache**: Delete a pasta `.expo` e tente novamente

## 🆘 Se Ainda Tiver Erro

Reporte:
1. **Mensagem exata do erro** (screenshot ou texto)
2. **Logs do Expo Metro** (a saída completa do console)
3. **Qual endpoint está falhando** (auth/login, service/request, etc)
4. **Status HTTP** (200, 400, 401, 500, etc)
