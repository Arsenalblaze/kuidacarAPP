# 🔍 DEBUG: Erro de Autenticação - Token

## ❌ Erro Atual
```
Erro na requisição /service/request: Error: Não autorizado. Faça login novamente.
```

---

## 🧪 TESTE PASSO A PASSO COM LOGS

Adicionei logs detalhados para identificar o problema. Siga estes passos:

### 📝 Passo 1: Limpar Tudo e Começar do Zero

1. **Abra o Console do Navegador (F12)**
2. **Vá para a aba Application/Armazenamento**
3. **Limpe tudo:**
   - Local Storage → Clique com botão direito → Clear
   - Session Storage → Limpar também
4. **Recarregue a página (Ctrl+Shift+R)**

---

### 📝 Passo 2: Fazer Login e Verificar Token

1. **Faça login com:**
   ```
   Email: maria@test.com
   Senha: 123456
   ```

2. **No Console, você DEVE ver:**
   ```
   ✅ Token salvo com sucesso: eyJhbGciOiJIUzI1Ni...
   ```

3. **Se NÃO aparecer esse log:**
   - ❌ O problema está no login
   - Verifique se o email/senha estão corretos
   - Verifique se o usuário foi criado

4. **Se aparecer, verifique no Application:**
   - Vá em **Application → Local Storage → seu-dominio**
   - DEVE ter uma chave chamada: `accessToken`
   - Valor deve começar com: `eyJhbGciOiJIUzI1Ni...`

---

### 📝 Passo 3: Criar Solicitação e Ver Logs

1. **Vá para página de serviços** (`/services`)
2. **Escolha qualquer serviço** (ex: Reboque)
3. **Preencha o formulário:**
   ```
   Localização: Av. 4 de Fevereiro, Luanda
   Descrição: Teste
   ```
4. **Clique em "Solicitar Assistência"**

5. **No Console, você DEVE ver:**
   ```
   📡 Request para /service/request: {
     hasToken: true,
     tokenPreview: "eyJhbGciOiJIUzI1Ni..."
   }
   ```

6. **Se `hasToken: false`:**
   - ❌ O token não está no localStorage
   - Faça logout e login novamente

7. **Se `hasToken: true`:**
   - ✅ Token está sendo enviado
   - O problema está no servidor (token inválido/expirado)

---

### 📝 Passo 4: Verificar Logs do Servidor

1. **Abra o Supabase Dashboard**
2. **Vá em: Edge Functions → Logs**
3. **Procure por:**

   **Se o token está chegando:**
   ```
   🔐 Authorization header: Bearer eyJhbGciOiJIUzI1Ni...
   🎫 Access token extraído: eyJhbGciOiJIUzI1Ni...
   ```

   **Se validação falha:**
   ```
   ❌ Erro ao validar token: invalid JWT signature
   ```

   **Se validação funciona:**
   ```
   ✅ Usuário autenticado: abc-123-def-456
   ✅ Solicitação criada: req_1234567890
   ```

---

## 🔍 CENÁRIOS E SOLUÇÕES

### Cenário 1: Token não salva no localStorage
**Sintomas:**
- Console não mostra "✅ Token salvo"
- localStorage não tem `accessToken`

**Causa:**
- Resposta do login não retorna `accessToken`

**Solução:**
1. Verifique se você cadastrou o usuário corretamente
2. Faça logout e login novamente
3. Se não funcionar, recadastre o usuário:
   ```
   Nome: Maria Santos
   Email: maria2@test.com (NOVO email)
   Senha: 123456
   ```

---

### Cenário 2: Token salva mas não é enviado
**Sintomas:**
- Console mostra "✅ Token salvo"
- localStorage TEM `accessToken`
- Mas: `hasToken: false` na requisição

**Causa:**
- Bug no `getAccessToken()`

**Solução:**
1. Recarregue a página (Ctrl+Shift+R)
2. Faça login novamente
3. Não navegue entre páginas após login, vá direto solicitar

---

### Cenário 3: Token enviado mas servidor rejeita
**Sintomas:**
- Console mostra `hasToken: true`
- Servidor mostra "❌ Erro ao validar token"

**Causa:**
- Token expirado (após 1 hora)
- Token inválido

**Solução:**
1. Faça logout
2. Faça login novamente (gera novo token)
3. Tente criar solicitação imediatamente

---

### Cenário 4: ANON KEY sendo usado em vez do token
**Sintomas:**
- Console mostra: `tokenPreview: "USANDO ANON KEY"`

**Causa:**
- Token não foi salvo ou foi perdido

**Solução:**
1. Faça logout completo
2. Limpe localStorage (F12 → Application → Clear)
3. Feche e abra o navegador
4. Faça login novamente

---

## 🧪 TESTE RÁPIDO (30 SEGUNDOS)

Execute este script no Console (F12):

```javascript
// Verificar se há token
const token = localStorage.getItem('accessToken');
console.log('🔍 Token no localStorage:', token ? '✅ SIM' : '❌ NÃO');

if (token) {
  console.log('📏 Tamanho do token:', token.length);
  console.log('🔤 Preview:', token.substring(0, 50) + '...');
  
  // Tentar decodificar (sem validar)
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      console.log('📦 Payload do token:', payload);
      console.log('⏰ Expira em:', new Date(payload.exp * 1000).toLocaleString());
      console.log('🆔 User ID:', payload.sub);
    }
  } catch (e) {
    console.error('❌ Erro ao decodificar token:', e);
  }
} else {
  console.log('❌ PROBLEMA: Você precisa fazer login primeiro!');
}
```

---

## 🎯 SOLUÇÃO MAIS PROVÁVEL

Baseado no erro, o problema mais comum é:

### ✅ SOLUÇÃO: Limpar e Refazer Login

1. **Abra F12 → Console**
2. **Execute:**
   ```javascript
   localStorage.clear();
   location.reload();
   ```
3. **Faça login novamente**
4. **Vá DIRETO para solicitar serviço**
5. **NÃO navegue muito entre páginas**

---

## 📊 CHECKLIST DE VERIFICAÇÃO

Execute este checklist em ordem:

- [ ] Console mostra "✅ Token salvo com sucesso"
- [ ] localStorage tem chave `accessToken`
- [ ] Token começa com `eyJ`
- [ ] Token tem 3 partes separadas por `.`
- [ ] Console mostra `hasToken: true` ao criar solicitação
- [ ] Servidor recebe o Authorization header
- [ ] Servidor valida o token sem erros
- [ ] Solicitação é criada com sucesso

**Se TODOS estiverem ✅:** Funciona!  
**Se algum estiver ❌:** Veja a seção correspondente acima.

---

## 🚨 SE NADA FUNCIONAR

Envie-me:

1. **Screenshot do Console** após fazer login
2. **Screenshot do localStorage** (F12 → Application)
3. **Screenshot do erro** ao criar solicitação
4. **Logs do servidor** (Supabase → Edge Functions → Logs)

Com essas informações, consigo identificar exatamente o problema!

---

## 🎓 ENTENDENDO O FLUXO

```
1. Login
   ↓
2. Servidor retorna accessToken
   ↓
3. Frontend salva no localStorage
   ↓
4. Ao criar solicitação, pega token do localStorage
   ↓
5. Envia no header: Authorization: Bearer TOKEN
   ↓
6. Servidor valida com Supabase Auth
   ↓
7. Se válido, cria solicitação
   ↓
8. Retorna sucesso!
```

O erro está acontecendo no passo **6** - Servidor não está conseguindo validar o token.

---

**Teste agora e me envie o resultado dos logs!** 🔍
