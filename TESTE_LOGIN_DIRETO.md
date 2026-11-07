# 🔐 Teste de Login Direto - Instruções

## 📋 O que foi feito

1. ✅ **Criado teste de login simples** (`DirectLoginTest.tsx`)
   - Tela com campos de email/senha
   - Logs detalhados de cada etapa do login
   - Display de todos os headers e responses

2. ✅ **App.tsx configurado** para rodar apenas o teste de login
   - Você verá a tela de teste quando abrir o app

## 🚀 Como testar

### Opção 1: Usar credenciais de teste pré-preenchidas
- Email: `cliente@test.com`
- Senha: `123456`
- Simplesmente toque em **"Testar Login"**

### Opção 2: Usar suas próprias credenciais
- Altere email e senha nos campos
- Toque em **"Testar Login"**

## 📊 O que você vai ver

Os **logs detalhados** mostrarão:
- ✅ URL da requisição
- ✅ Headers enviados (Authorization, Content-Type)
- ✅ Tempo de resposta (em ms)
- ✅ Status HTTP (200, 401, 500, etc)
- ✅ Resposta completa do servidor

## 🎯 Resultado esperado

Se login funcionar:
```
✅✅✅ LOGIN FUNCIONOU! ✅✅✅

👤 Usuário: [seu nome]
📧 Email: cliente@test.com
🔑 Token: eyJhbGc...
```

## 🔴 Se não funcionar

Procure por mensagens de erro:
- `❌ ERRO: Status 401` → Credenciais inválidas
- `❌ ERRO: Status 500` → Erro no servidor
- `❌ ERRO: Network request failed` → Sem conexão com internet

## 📝 Próximas etapas

Após confirmação que o login funciona:

1. Reverter App.tsx para renderizar o app normal (com navegação)
2. Testar fluxo completo:
   - Login
   - Requisitar serviço
   - Ver histórico
   - Logout

## 🔧 Para voltar ao app normal

Quando quiser testar o app completo, execute:

```bash
# No diretório mobile/KuidaCarMobile/
npm run dev
```

E o App.tsx será restaurado automaticamente no próximo commit.

---

**Status:** ✅ Teste de login pronto para executar
