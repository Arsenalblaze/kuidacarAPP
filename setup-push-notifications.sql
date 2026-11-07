-- ========================================================
-- Setup: Push Notifications Tables
-- ========================================================
-- Este script cria as tabelas necessárias para o sistema
-- de notificações push do KuidaCar
--
-- IMPORTANTE: Execute este script no Supabase SQL Editor
-- ========================================================

-- ========================================================
-- 1. Tabela: push_subscriptions
-- Armazena os endpoints de subscription dos usuários
-- ========================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Índice para buscar subscriptions por usuário (mais rápido)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
  ON push_subscriptions(user_id);

-- Índice para ordenar por data de criação
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_created_at 
  ON push_subscriptions(created_at);

-- Comentário na tabela
COMMENT ON TABLE push_subscriptions IS 
  'Armazena as subscriptions de push notification de cada usuário. Uma subscription contém o endpoint e as chaves para enviar notificações push reais.';

COMMENT ON COLUMN push_subscriptions.user_id IS 
  'ID do usuário (referência à tabela auth.users)';

COMMENT ON COLUMN push_subscriptions.endpoint IS 
  'URL do servidor de push (fornecido pelo navegador)';

COMMENT ON COLUMN push_subscriptions.p256dh IS 
  'Chave de criptografia p256dh (base64)';

COMMENT ON COLUMN push_subscriptions.auth IS 
  'Chave de autenticação (base64)';

-- ========================================================
-- 2. Tabela: push_notification_logs (opcional)
-- Registra histórico de notificações enviadas
-- ========================================================

CREATE TABLE IF NOT EXISTS push_notification_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  title TEXT,
  message TEXT,
  status TEXT DEFAULT 'sent', -- 'sent', 'failed', 'expired'
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  request_id TEXT
);

-- Índice para buscar logs por usuário (mais rápido)
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_user_id 
  ON push_notification_logs(user_id);

-- Índice para ordenar por data de envio
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_sent_at 
  ON push_notification_logs(sent_at DESC);

-- Índice para filtrar por status
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_status 
  ON push_notification_logs(status);

-- Comentário na tabela
COMMENT ON TABLE push_notification_logs IS 
  'Registra o histórico de notificações push enviadas. Útil para auditoria e troubleshooting.';

-- ========================================================
-- 3. RLS (Row Level Security)
-- ========================================================

-- Habilitar RLS na tabela push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Permitir que usuários vejam apenas suas próprias subscriptions
CREATE POLICY "Users can view their own subscriptions" 
  ON push_subscriptions 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Permitir que usuários criem subscriptions para si mesmos
CREATE POLICY "Users can create their own subscriptions" 
  ON push_subscriptions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Permitir que usuários atualizem suas próprias subscriptions
CREATE POLICY "Users can update their own subscriptions" 
  ON push_subscriptions 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Permitir que usuários deletem suas próprias subscriptions
CREATE POLICY "Users can delete their own subscriptions" 
  ON push_subscriptions 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Habilitar RLS na tabela push_notification_logs
ALTER TABLE push_notification_logs ENABLE ROW LEVEL SECURITY;

-- Permitir que Edge Functions (service role) acessem tudo
CREATE POLICY "Edge Functions can manage logs" 
  ON push_notification_logs 
  FOR ALL 
  USING (true);

-- ========================================================
-- 4. Verificação
-- ========================================================

-- Verificar se as tabelas foram criadas
SELECT 
  table_name,
  column_name,
  data_type
FROM 
  information_schema.columns
WHERE 
  table_name IN ('push_subscriptions', 'push_notification_logs')
ORDER BY 
  table_name, 
  ordinal_position;

-- ========================================================
-- 5. Instruções Finais
-- ========================================================

-- Após executar este script:
--
-- 1. Verifique as tabelas foram criadas:
--    SELECT * FROM push_subscriptions;
--    SELECT * FROM push_notification_logs;
--
-- 2. Adicione os secrets VAPID no Supabase:
--    - VAPID_PUBLIC_KEY
--    - VAPID_PRIVATE_KEY
--    (Vá em: Settings > Secrets)
--
-- 3. Deploy da Edge Function:
--    supabase functions deploy send-push-notification
--
-- 4. Implemente o frontend:
--    - src/app/hooks/usePushNotifications.ts
--    - public/sw.js
--    - Adicione vapidPublicKey em usePushNotifications.ts
--
-- 5. Teste a notificação:
--    - Abra o app no navegador
--    - Clique em "Ativar Notificações"
--    - Verifique se a subscription foi salva
--    - Use supabase.functions.invoke() para enviar teste

-- ========================================================
-- Fim do Setup
-- ========================================================
