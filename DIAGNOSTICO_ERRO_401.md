# 🔍 DIAGNÓSTICO: Erro 401 em Rotas Públicas

## ❌ Problema Atual
```
❌ Erro 401 - Endpoint: /service/pending/all Token: ausente
❌ Erro 401 - Endpoint: /auth/login Token: ausente
```

Rotas públicas estão retornando 401, mas **não deveriam exigir autenticação**.

---

## 🧪 TESTE 1: Verificar se o Servidor Está Rodando

Abra o Console (F12) e execute:

```javascript
// Teste 1: Health Check
fetch('https://' + window.location.host.split('.')[0] + '.supabase.co/functions/v1/make-server-9dc5328a/health')
  .then(r => r.json())
  .then(d => console.log('✅ Servidor OK:', d))
  .catch(e => console.error('❌ Servidor OFF:', e));
```

**Resultado Esperado:**
```
✅ Servidor OK: { status: "ok" }
```

**Se der erro:**
- ❌ Servidor não está rodando
- ❌ URL está errada
- ❌ CORS bloqueando

---

## 🧪 TESTE 2: Verificar CORS

```javascript
// Teste 2: CORS Check
fetch('https://' + window.location.host.split('.')[0] + '.supabase.co/functions/v1/make-server-9dc5328a/service/pending/all', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
})
  .then(r => {
    console.log('📥 Status:', r.status);
    return r.json();
  })
  .then(d => console.log('📦 Data:', d))
  .catch(e => console.error('❌ Erro:', e));
```

**Resultado Esperado:**
```
📥 Status: 200
📦 Data: { success: true, requests: [...] }
```

**Se der erro CORS:**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```
→ Problema no servidor (CORS mal configurado)

---

## 🧪 TESTE 3: Login Direto

```javascript
// Teste 3: Login sem ApiClient
fetch('https://' + window.location.host.split('.')[0] + '.supabase.co/functions/v1/make-server-9dc5328a/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'maria@test.com',
    password: '123456'
  })
})
  .then(r => {
    console.log('📥 Status:', r.status);
    return r.json();
  })
  .then(d => {
    console.log('📦 Login Response:', d);
    if (d.accessToken) {
      console.log('✅ Token recebido:', d.accessToken.substring(0, 30) + '...');
      localStorage.setItem('accessToken', d.accessToken);
    }
  })
  .catch(e => console.error('❌ Erro:', e));
```

**Resultado Esperado:**
```
📥 Status: 200
📦 Login Response: { success: true, user: {...}, accessToken: "eyJ..." }
✅ Token recebido: eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

---

## 🔍 POSSÍVEIS CAUSAS

### Causa 1: Servidor Não Está Deployado
**Sintomas:**
- Todos os testes acima falham com erro de conexão
- Network tab mostra "Failed to fetch"

**Solução:**
1. Vá para Supabase Dashboard
2. Edge Functions → deploy o servidor
3. Verifique logs

---

### Causa 2: URL Errada
**Sintomas:**
- 404 Not Found
- "Function not found"

**Solução:**
Verifique `/utils/supabase/info.tsx` e confirme:
```typescript
export const projectId = "seu-project-id";
```

URL deve ser:
```
https://seu-project-id.supabase.co/functions/v1/make-server-9dc5328a/...
```

---

### Causa 3: CORS Bloqueando
**Sintomas:**
- Console mostra erro de CORS
- Preflight OPTIONS falhando

**Solução:**
Servidor já tem CORS configurado, mas pode precisar de restart.

---

### Causa 4: Response Não é JSON
**Sintomas:**
- "Erro ao fazer parse do JSON"
- Response é HTML ou texto

**Solução:**
Verifique logs do servidor - pode estar retornando erro HTML.

---

### Causa 5: Servidor Retorna 401 por Erro Interno
**Sintomas:**
- Status 200 mas response é erro
- Servidor crashando

**Solução:**
1. Abra Supabase Dashboard
2. Edge Functions → Logs
3. Procure por erros

---

## 🎯 AÇÃO IMEDIATA

Execute este script completo no Console:

```javascript
// DIAGNÓSTICO COMPLETO
(async function() {
  const baseUrl = `https://${window.location.host.split('.')[0]}.supabase.co/functions/v1/make-server-9dc5328a`;
  
  console.log('🔍 DIAGNÓSTICO INICIADO');
  console.log('📍 Base URL:', baseUrl);
  console.log('');
  
  // Test 1: Health
  console.log('1️⃣ Testando Health Check...');
  try {
    const r1 = await fetch(`${baseUrl}/health`);
    const d1 = await r1.json();
    console.log('✅ Health:', d1);
  } catch (e) {
    console.error('❌ Health FALHOU:', e.message);
    return;
  }
  
  console.log('');
  
  // Test 2: Pending Services (Public)
  console.log('2️⃣ Testando Solicitações Pendentes (rota pública)...');
  try {
    const r2 = await fetch(`${baseUrl}/service/pending/all`);
    console.log('   Status:', r2.status);
    const d2 = await r2.json();
    console.log('✅ Pending Services:', d2);
  } catch (e) {
    console.error('❌ Pending Services FALHOU:', e.message);
  }
  
  console.log('');
  
  // Test 3: Login
  console.log('3️⃣ Testando Login...');
  try {
    const r3 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maria@test.com', password: '123456' })
    });
    console.log('   Status:', r3.status);
    const d3 = await r3.json();
    
    if (d3.success && d3.accessToken) {
      console.log('✅ Login OK!');
      console.log('   User:', d3.user.name);
      console.log('   Token:', d3.accessToken.substring(0, 30) + '...');
      localStorage.setItem('accessToken', d3.accessToken);
    } else {
      console.error('❌ Login retornou erro:', d3);
    }
  } catch (e) {
    console.error('❌ Login FALHOU:', e.message);
  }
  
  console.log('');
  console.log('✅ DIAGNÓSTICO COMPLETO!');
})();
```

---

## 📋 CHECKLIST DE VERIFICAÇÃO

Execute o script acima e marque:

- [ ] Health Check retorna `{ status: "ok" }`
- [ ] Pending Services retorna `{ success: true }`
- [ ] Login retorna `{ success: true, accessToken: "..." }`
- [ ] Token é salvo no localStorage
- [ ] Nenhum erro de CORS no console
- [ ] Network tab mostra status 200

**Se TODOS ✅:** O problema está no apiClient (código)  
**Se ALGUM ❌:** O problema está no servidor (deploy/config)

---

## 📤 ENVIE OS RESULTADOS

Após executar o script, me envie:

1. **Print do Console** com todos os logs
2. **Print da Network tab** (F12 → Network)
3. **Print do Supabase Logs** (Dashboard → Edge Functions → Logs)

Com isso vou identificar exatamente o problema! 🎯
