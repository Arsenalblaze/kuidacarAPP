# 🚀 Deployment Rápido: Push Notifications

## ⚡ 5 Passos para Colocar em Produção

### 1️⃣ Gerar Chaves VAPID (2 min)

```bash
node generate-vapid-keys.js
```

**Output:**
```
✅ CHAVES GERADAS COM SUCESSO!

CHAVE PÚBLICA: BDxN_mgX1K-CXJGp1EQBFF8b85CZHlSULu4eC08IO9EPJVhuQKn5eLn1ykgFUTm4Sf6qcjWrqY6PjYj9cQYfd8k

CHAVE PRIVADA: R_1V0wlYv0z1e_9s3x2b4v5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6
```

### 2️⃣ Adicionar Secrets no Supabase (2 min)

Dashboard → Project Settings → Secrets

| Nome | Valor |
|------|-------|
| `VAPID_PRIVATE_KEY` | `R_1V0wlYv0z1e_9s3x2b4v5c...` |
| `VAPID_PUBLIC_KEY` | `BDxN_mgX1K-CXJGp1EQ...` |

### 3️⃣ Criar Tabelas (2 min)

SQL Editor → Copie de `setup-push-notifications.sql` e execute

### 4️⃣ Deploy Edge Function (1 min)

```bash
# Linux / macOS
./deploy-push-notifications.sh

# Windows
deploy-push-notifications.bat

# Ou manualmente
supabase functions deploy send-push-notification
```

### 5️⃣ Atualizar Frontend (2 min)

`src/app/hooks/usePushNotifications.ts`:

```typescript
const vapidPublicKey = 'BDxN_mgX1K-CXJGp1EQBFF8b85CZHlSULu4eC08IO9EPJVhuQKn5eLn1ykgFUTm4Sf6qcjWrqY6PjYj9cQYfd8k';
```

## ✅ Verificação

```bash
# Testar se a função foi deployada
supabase functions list

# Ver logs da função
supabase functions logs send-push-notification

# Monitorar em tempo real
supabase functions logs send-push-notification --tail
```

## 📝 Teste

No console do browser:

```javascript
const { data, error } = await supabase.functions.invoke('send-push-notification', {
  body: {
    userId: 'seu-user-id',
    title: 'Teste',
    message: 'Funciona!',
    url: '/'
  }
});

console.log(data, error);
```

## 📚 Documentação Completa

- [PUSH_NOTIFICATIONS_GUIDE.md](./PUSH_NOTIFICATIONS_GUIDE.md) - Guia completo
- [setup-push-notifications.sql](./setup-push-notifications.sql) - Script SQL
- [supabase/functions/send-push-notification/README.md](./supabase/functions/send-push-notification/README.md) - Documentação técnica

## 🐛 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| "VAPID_PRIVATE_KEY não configurada" | Adicione em Settings → Secrets |
| "Nenhuma subscription encontrada" | Usuário precisa clicar "Ativar Notificações" |
| "Service Worker não registrado" | Recarregue a página e confira DevTools |
| Notificação não aparece | Verifique permissões do browser |

## 🎯 Próximos Passos

1. Integrar notificações no código
2. Testar com múltiplos usuários
3. Monitorar logs em produção
4. Setup alertas no Supabase

---

**Tempo total: ~15 minutos** ⏱️
