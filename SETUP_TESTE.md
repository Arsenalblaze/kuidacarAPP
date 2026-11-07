# Setup de Testes - Guia Rápido

## Problema
O app está tentando conectar à Edge Function do Supabase em `http://localhost:54321`, mas você precisa do mock server rodando.

## Solução

### ✅ Opção 1: Iniciar tudo de uma vez (RECOMENDADO)

Abra um terminal e execute:
```powershell
cd "c:\Users\Lenovo\Desktop\Aplicativo de Assistência Rodoviária"
node start-dev.js
```

Isso vai iniciar:
1. Mock Server na porta 54321
2. Dev Server (Vite) na porta 5173

### ✅ Opção 2: Iniciar em terminais separados

**Terminal 1 - Mock Server:**
```powershell
cd "c:\Users\Lenovo\Desktop\Aplicativo de Assistência Rodoviária"
node temp-mock-server.js
```

Você deve ver:
```
🚀 Iniciando Mock Server...
📡 URL base: http://localhost:54321/functions/v1/make-server-9dc5328a
```

**Terminal 2 - Dev Server:**
```powershell
cd "c:\Users\Lenovo\Desktop\Aplicativo de Assistência Rodoviária"
npm run dev
```

Você deve ver:
```
Local:   http://localhost:5173/
```

## ✅ Testar a Aplicação

### 1. Registrar um novo usuário

1. Abra `http://localhost:5173/register`
2. Preencha o formulário:
   - **Nome**: João Silva
   - **Email**: joao@test.com
   - **Senha**: 123456
   - **Telefone**: +244 923 456 789
   - **Tipo de Usuário**: Prestador
   - **Tipo de Serviço**: Troca de Pneu
   - **Modelo do Veículo**: Toyota Hilux
   - **Placa do Veículo**: ABC-1234
3. Clique em "Registrar"

Você deve ser redirecionado para a home page.

### 2. Fazer login

1. Clique em "Entrar" ou vá para `http://localhost:5173/login`
2. Use as credenciais:
   - **Email**: joao@test.com (ou o que você registrou)
   - **Senha**: 123456
3. Você deve ser redirecionado para a home page autenticado

### 3. Ativar modo online (para prestadores)

1. Se você logou como prestador, vá para `http://localhost:5173/provider-dashboard`
2. Clique no toggle "Online"
3. Permita o acesso à localização
4. O app deve salvar sua localização no mock server

### 4. Solicitar um serviço (para clientes)

1. Vá para `http://localhost:5173/request-service`
2. Selecione o tipo de serviço
3. Clique em "Usar Minha Localização Atual"
4. O app deve buscar os prestadores online (aqueles com `online: true`)
5. Você pode selecionar um prestador e fazer a solicitação

## 🔍 Debugging

### Verificar logs no terminal (Mock Server)
O mock server exibe logs de todas as requisições:
```
🔐 Tentativa de login: joao@test.com
✅ Login bem-sucedido para: João Silva
📡 Criando solicitação de serviço para: João Silva
```

### Verificar logs no navegador (DevTools)
Abra o Console (F12) para ver logs do app:
```
🌐 API Base URL: http://localhost:54321/functions/v1/make-server-9dc5328a
📡 [API] Request para /auth/login
📥 [API] Response de /auth/login: { success: true, user: {...} }
```

## ⚠️ Problemas Comuns

### "Erro de conectividade com http://localhost:54321"
- Verifique se o mock server está rodando no Terminal 1
- Veja se a porta 54321 está disponível

### "Token inválido ou expirado"
- O token de mock server expira em 7 dias
- Faça logout e login novamente

### "Permissão de localização negada"
- O navegador está bloqueando a localização
- Vá para as configurações do navegador e permita acesso à localização

---

**Nota**: O mock server é apenas para desenvolvimento local. Em produção, a app conectará diretamente à Supabase.
