# 📨 Guia Completo: Sistema de Notificações Push

## 🎯 Objetivo

Implementar um sistema de notificações push reais que permita:
- Notificar usuários de novas solicitações
- Avisar sobre atualizações em tempo real
- Funcionar em navegadores e aplicações mobile
- Trabalhar mesmo quando o app está em background

## 📦 Stack

- **Frontend**: React + TypeScript
- **Backend**: Supabase Edge Functions
- **Notificações**: Web Push API + VAPID
- **Banco de Dados**: Supabase (PostgreSQL)
- **Registro**: Service Worker (sw.js)

## 🚀 Quick Start (15 minutos)

### Passo 1: Gerar Chaves VAPID

```bash
# Instalar web-push globalmente
npm install -g web-push

# Gerar chaves
web-push generate-vapid-keys
```

**Saída esperada:**
```
Public Key:  BDxN_mgX1K-CXJGp1EQBFF8b85CZHlSULu4eC08IO9EPJVhuQKn5eLn1ykgFUTm4Sf6qcjWrqY6PjYj9cQYfd8k
Private Key: R_1V0wlYv0z1e_9s3x2b4v5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6
```

### Passo 2: Configurar Secrets no Supabase

1. Vá ao **Supabase Dashboard**
2. Projeto → **Settings** → **Secrets**
3. Adicione dois secrets:

| Nome | Valor |
|------|-------|
| `VAPID_PRIVATE_KEY` | `R_1V0wlYv0z1e_9s3x2b4v5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6` |
| `VAPID_PUBLIC_KEY` | `BDxN_mgX1K-CXJGp1EQBFF8b85CZHlSULu4eC08IO9EPJVhuQKn5eLn1ykgFUTm4Sf6qcjWrqY6PjYj9cQYfd8k` |

### Passo 3: Criar Tabelas no Supabase

Copie todo o conteúdo de `setup-push-notifications.sql` e execute no **Supabase SQL Editor**.

### Passo 4: Deploy da Edge Function

```bash
# Fazer login no Supabase
supabase login

# Deploy da função
supabase functions deploy send-push-notification
```

### Passo 5: Atualizar Frontend

Em `src/app/hooks/usePushNotifications.ts`, adicione a chave pública VAPID:

```typescript
const vapidPublicKey = 'BDxN_mgX1K-CXJGp1EQBFF8b85CZHlSULu4eC08IO9EPJVhuQKn5eLn1ykgFUTm4Sf6qcjWrqY6PjYj9cQYfd8k';
```

## 📋 Arquivos do Sistema

```
projeto/
├── supabase/
│   ├── config.toml
│   └── functions/
│       └── send-push-notification/          ← Edge Function
│           ├── index.ts                     ← Lógica principal
│           └── README.md                    ← Documentação da função
│
├── src/
│   └── app/
│       ├── hooks/
│       │   └── usePushNotifications.ts      ← Hook React (gerencia subscriptions)
│       └── utils/
│           └── api.ts                       ← Cliente API
│
├── public/
│   └── sw.js                                ← Service Worker
│
├── setup-push-notifications.sql             ← Script de setup (este arquivo)
├── PUSH_NOTIFICATIONS_GUIDE.md              ← Guia (este arquivo)
└── generate-vapid-keys.js                   ← Script para gerar chaves
```

## 🔄 Fluxo Completo

```
┌─────────────────────────────────────────┐
│ 1. Usuário abre o app                   │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│ 2. usePushNotifications.ts               │
│    └─ Registra Service Worker (sw.js)   │
│    └─ Pede permissão de notificações    │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│ 3. Navegador gera subscription          │
│    └─ endpoint                          │
│    └─ p256dh + auth (chaves)            │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│ 4. Salva em push_subscriptions table     │
│    └─ user_id, endpoint, keys           │
└─────────────┬───────────────────────────┘
              │
        [usuário pronto para receber notificações]
              │
              ↓ (quando um evento acontece)
┌─────────────────────────────────────────┐
│ 5. Backend / Frontend chama:            │
│    supabase.functions.invoke(            │
│      'send-push-notification', {         │
│        userId,                           │
│        title,                            │
│        message,                          │
│        url                               │
│      }                                   │
│    )                                     │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│ 6. Edge Function: send-push-notification│
│    └─ Busca subscription do user        │
│    └─ Valida chaves VAPID               │
│    └─ Envia via web-push                │
│    └─ Trata erros (410, etc)            │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│ 7. Servidor Push entrega ao navegador   │
│    └─ FCM / Chrome Push / Safari        │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│ 8. Service Worker (sw.js) recebe        │
│    └─ Decodifica e exibe a notificação  │
│    └─ Trata cliques e ações             │
└─────────────────────────────────────────┘
```

## 💻 Exemplos de Código

### Exemplo 1: Notificar quando solicitação é criada

```typescript
// src/app/pages/RequestService.tsx

const handleCreateRequest = async (requestData) => {
  try {
    // 1. Criar solicitação
    const response = await apiClient.createServiceRequest(requestData);
    const requestId = response.request.id;

    // 2. Notificar mecânicos disponíveis
    const { data: mechanics } = await supabase
      .from('profiles')
      .select('id, user_id')
      .eq('role', 'provider')
      .eq('is_online', true);

    // 3. Enviar notificações para cada mecânico
    for (const mechanic of mechanics) {
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: mechanic.user_id,
            title: '🔧 Nova Solicitação Disponível',
            message: `${requestData.type} - ${requestData.location.address}`,
            url: `/dashboard?highlight=${requestId}`,
            requestId
          }
        });
      } catch (error) {
        console.warn(`Não foi possível notificar ${mechanic.id}:`, error);
      }
    }

    toast.success('Solicitação criada e mecânicos notificados!');
  } catch (error) {
    console.error('Erro:', error);
  }
};
```

### Exemplo 2: Notificar quando solicitação é aceita

```typescript
// src/app/pages/ProviderDashboard.tsx

const handleAcceptRequest = async (requestId: string) => {
  try {
    // 1. Aceitar solicitação
    const response = await apiClient.updateServiceRequest(requestId, {
      status: 'accepted',
      providerId: user.id
    });

    // 2. Buscar ID do cliente
    const { data: request } = await supabase
      .from('service_requests')
      .select('customer_id')
      .eq('id', requestId)
      .single();

    // 3. Notificar cliente
    if (request?.customer_id) {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: request.customer_id,
          title: '✅ Solicitação Aceita!',
          message: `${user.name} aceitou sua solicitação. Preparando-se para chegar...`,
          url: `/request/${requestId}`,
          requestId
        }
      });
    }

    toast.success('Solicitação aceita!');
  } catch (error) {
    console.error('Erro:', error);
  }
};
```

### Exemplo 3: Testar notificação via console

```typescript
// Cole no DevTools console do navegador
const testNotification = async () => {
  const user = (await supabase.auth.getUser()).data.user;
  
  const response = await supabase.functions.invoke('send-push-notification', {
    body: {
      userId: user.id,
      title: 'Teste de Notificação',
      message: 'Se você vê isto, as notificações estão funcionando! 🎉',
      url: '/',
      requestId: null
    }
  });

  console.log('Resposta:', response);
};

testNotification();
```

## 🔍 Troubleshooting

### ❌ Problema: "VAPID keys não configuradas"

**Solução:**
1. Verifique Supabase Dashboard → Settings → Secrets
2. Confirme que `VAPID_PRIVATE_KEY` existe
3. Tente fazer deploy novamente: `supabase functions deploy send-push-notification`

### ❌ Problema: "Service Worker não registrado"

**Solução:**
```javascript
// DevTools Console
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Registrações encontradas:', regs);
  if (regs.length === 0) console.log('Nenhum SW registrado!');
});
```

**Se não encontrar:**
1. Confirme que `public/sw.js` existe
2. Verifique se `usePushNotifications.ts` foi chamado
3. Teste em localhost sem HTTPS (Chrome permite) ou com HTTPS

### ❌ Problema: "Permissão de notificação negada"

**Solução:**
1. Clique no ícone de cadeado na barra de URL
2. Encontre "Notificações"
3. Clique em "Sempre Permitir"
4. Recarregue a página

### ❌ Problema: "Notificação não aparece"

**Causa possível 1:** Subscription expirada (24-90 dias)
- **Solução:** Chamar `subscribeToPush()` novamente

**Causa possível 2:** Service Worker não recebendo eventos
- **Verificar:** Abrir DevTools → Application → Service Workers
- **Verificar:** Application → Manifest (se PWA)

**Causa possível 3:** Navegador bloqueando
- **Verificar:** Chrome Settings → Privacy → Notifications
- **Solução:** Adicione o site à lista de permissão

### ❌ Problema: "Erro 410 Gone"

**Causa:** Subscription expirou no servidor de push
**Solução:** Função remove automaticamente, usuário precisa reinscrever

## ✅ Checklist de Produção

- [ ] VAPID keys geradas e seguras
- [ ] Secrets adicionados no Supabase (prod)
- [ ] Tabelas criadas e RLS configurado
- [ ] Edge Function deployada
- [ ] HTTPS ativado (required para push notifications)
- [ ] Service Worker funciona
- [ ] Hook React implementado
- [ ] Notificações testadas
- [ ] Logs configurados
- [ ] Error handling em produção
- [ ] Monitoramento de failures
- [ ] Backup de chaves VAPID

## 📚 Referências Úteis

- [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [MDN: Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN: Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [Web Push Protocol](https://www.w3.org/TR/push-api/)
- [npm: web-push](https://www.npmjs.com/package/web-push)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

## 🆘 Suporte

Se encontrar problemas:

1. **Verifique os logs:**
   - Supabase Dashboard → Functions → Logs
   - DevTools Console (frontend)
   - Application → Service Workers (Chrome)

2. **Teste step-by-step:**
   - Subscription foi criada? `SELECT * FROM push_subscriptions`
   - Keys VAPID existem? Supabase Settings → Secrets
   - Função está deployada? `supabase functions list`

3. **Procure por:**
   - Mensagens de erro nos logs
   - Erros de CORS (deve estar permitido)
   - Problema de timezone nos timestamps

## 🎓 Próximos Passos

- [ ] Implementar notificações persistentes
- [ ] Adicionar badge de número de notificações
- [ ] Implementar ações na notificação (aceitar/recusar)
- [ ] Setup de testes automatizados
- [ ] Monitoramento e alertas
- [ ] Analytics de engajamento

---

**Última atualização:** Maio 2026
**Status:** ✅ Em produção
