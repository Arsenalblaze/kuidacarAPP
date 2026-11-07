# 🔔 Sistema de Notificações Push - KuidaCar

Este guia explica como configurar as notificações push do KuidaCar: Web Push com VAPID nos navegadores e OneSignal no Android nativo. O Supabase continua responsável pela autenticação, banco de dados e Edge Function.

## 📋 Funcionalidades

- ✅ Web Push para navegadores e OneSignal para Android nativo
- ✅ Funciona mesmo com app em segundo plano
- ✅ Integração com Supabase realtime
- ✅ Service Worker para PWA
- ✅ Interface para ativar/desativar notificações
- ✅ Teste de notificações

## 🚀 Configuração Rápida

### 1. Executar SQL no Supabase

Execute este SQL no **SQL Editor** do Supabase:

```sql
-- Criar tabela para push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own push subscriptions" ON push_subscriptions FOR ALL USING (auth.uid()::text = user_id);
```

### 2. Gerar Chaves VAPID

**IMPORTANTE:** Use o script Node.js correto (não no navegador!)

```bash
# Execute no terminal (não no navegador!)
node generate-vapid-keys.js
```

O script gerará automaticamente:
- `VAPID_PUBLIC_KEY` - Para o frontend
- `VAPID_PRIVATE_KEY` - Para o Supabase Edge Functions

**Por que não usar crypto.subtle no navegador?**
- As chaves geradas no navegador não são compatíveis com Web Push
- Precisam estar no formato PKCS#8 correto
- A biblioteca `web-push` garante compatibilidade total

### 3. Configurar Edge Function no Supabase

1. No Supabase Dashboard, vá para **Edge Functions**
2. Crie uma nova função chamada `send-push-notification`
3. Cole o código do arquivo `supabase/functions/send-push-notification/index.ts`
4. Configure os secrets usados pela Edge Function:
   - **Nome**: `VAPID_PRIVATE_KEY`
   - **Valor**: A chave privada gerada no passo 2
   - **Nome**: `VAPID_PUBLIC_KEY`
   - **Valor**: A chave pública correspondente
   - **Nome**: `ONESIGNAL_APP_ID`
   - **Valor**: O App ID do projeto OneSignal
   - **Nome**: `ONESIGNAL_REST_API_KEY`
   - **Valor**: A App API Key do OneSignal; mantenha-a apenas nos secrets do Supabase

### 4. Configurar o app

Para Web Push, a chave pública usada em `src/app/hooks/usePushNotifications.ts` deve corresponder à chave configurada na Edge Function. A chave pública pode estar no frontend; nunca coloque a chave privada no app.

Para Android nativo, configure `VITE_ONESIGNAL_APP_ID` no ambiente de build. No dashboard OneSignal, configure o Firebase Cloud Messaging e disponibilize o `google-services.json` do mesmo projeto Firebase em `android/app/`. A REST API Key do OneSignal não deve ser adicionada ao frontend.

### 5. Deploy da Edge Function

```bash
supabase functions deploy send-push-notification
```

## 🧪 Como Testar

1. **Ativar notificações**: Na página de solicitação de serviço, clique em "Ativar" nas notificações push
2. **Testar notificação**: Clique no botão "Testar" para enviar uma notificação de teste
3. **Simular aceite**: Em outra aba/janela, faça login como prestador e aceite um pedido
4. **Verificar**: A notificação deve aparecer na barra do sistema

## 📁 Arquivos Criados/Modificados

### Novos Arquivos:
- `public/sw.js` - Service Worker para notificações push
- `src/app/hooks/usePushNotifications.ts` - Hook para gerenciar push notifications
- `supabase/functions/send-push-notification/index.ts` - Edge Function para enviar push
- `generate-vapid-keys.js` - Script para gerar chaves VAPID

### Arquivos Modificados:
- `create-all-tables.sql` - Adicionada tabela push_subscriptions
- `src/app/pages/RequestService.tsx` - Interface para ativar notificações
- `src/app/pages/ProviderDashboard.tsx` - Integração para enviar push ao aceitar pedido

## 🔧 Como Funciona

### Web Push no navegador:

1. **Cliente ativa notificações** → Service Worker cria uma subscription e ela é salva no Supabase.
2. **Evento de serviço** → O app chama a Edge Function autenticada.
3. **Edge Function** → Busca a subscription e envia com VAPID.
4. **Service Worker** → Exibe a notificação e trata o clique.

### Android nativo:

1. **Usuário entra na conta** → O app associa o ID Supabase ao OneSignal como `external_id`.
2. **Evento de serviço** → O app chama a mesma Edge Function autenticada.
3. **Edge Function** → Envia ao OneSignal, que entrega ao Android usando FCM.
4. **Logout/troca de conta** → O app encerra a identidade OneSignal anterior antes de associar outra.

### Tecnologias Usadas:

- **Web Push API** - Para notificações nativas
- **Service Worker** - Para receber push em background
- **Supabase Edge Functions** - Para enviar notificações server-side
- **VAPID** - Para autenticação das notificações
- **OneSignal + FCM** - Para entrega de notificações Android nativas
- **React Hooks** - Para gerenciar estado das notificações

## 🐛 Troubleshooting

### Notificações não aparecem:
1. Verifique se o browser suporta notificações push
2. Confirme que a permissão foi concedida
3. Verifique se o Service Worker está registrado (DevTools > Application > Service Workers)
4. Teste com o botão "Testar" primeiro

### Edge Function falha:
1. Verifique se a VAPID_PRIVATE_KEY está configurada
2. Confirme se a função foi deployada: `supabase functions list`
3. Verifique logs: `supabase functions logs send-push-notification`

### Subscription não salva:
1. Verifique se a tabela push_subscriptions foi criada
2. Confirme se o usuário está autenticado
3. Verifique RLS policies

## 📱 Suporte Mobile

Web Push funciona em navegadores compatíveis. O app Android nativo usa OneSignal/FCM; não depende da API Web Push nem do Service Worker para receber notificações.

**Nota**: este fluxo nativo implementa Android. O app iOS requer configuração e validação próprias de push.

### Android nativo com OneSignal

O banco, autenticação e Edge Functions continuam no Supabase. OneSignal gerencia as subscriptions e entrega o push ao app. No Android, a entrega usa FCM por trás, configurado no OneSignal; não é necessário guardar tokens FCM na tabela do Supabase.

1. Crie/configure o app OneSignal para Android usando o package `com.kuidacar.app`; copie o **App ID** do dashboard.
2. No OneSignal, conecte as credenciais Firebase Cloud Messaging do seu app. Baixe o `google-services.json` correspondente ao mesmo projeto Firebase e coloque-o em `android/app/`. Não envie credenciais privadas ao repositório.
3. Configure `VITE_ONESIGNAL_APP_ID` no ambiente usado para compilar o app web/Android. O App ID é público e pode ficar no ambiente de build, mas não coloque a REST API Key no frontend.
4. Configure os secrets `ONESIGNAL_APP_ID` e `ONESIGNAL_REST_API_KEY` na Edge Function do Supabase. A chave REST é secreta e não deve estar no app.
5. Faça deploy: `supabase functions deploy send-push-notification`.
6. Gere o app atualizado com `npm run build`, `npx cap sync android` e compile/instale o APK. Aceite a permissão de notificações e teste.

O app associa o usuário autenticado ao OneSignal usando o ID de usuário do Supabase. No logout, o SDK encerra essa identidade; ao entrar com outra conta, a subscription do dispositivo é reassociada. Não é necessário armazenar tokens FCM em uma tabela Supabase para este fluxo.

O Web Push na versão navegador continua usando Service Worker, VAPID e a tabela `push_subscriptions`, sem passar pelo OneSignal.

## 🔒 Segurança

- Chaves VAPID são usadas para autenticação
- Subscriptions são armazenadas com RLS (Row Level Security)
- Apenas o dono da subscription pode gerenciá-la
- Edge Functions rodam em ambiente seguro do Supabase

## 🚀 Próximos Passos

- [ ] Adicionar tipos de notificação customizáveis
- [ ] Implementar fila de notificações offline
- [ ] Dashboard de analytics de notificações