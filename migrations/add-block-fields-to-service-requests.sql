-- Migration: adiciona campos de bloqueio à tabela service_requests
-- Executar no Supabase SQL editor ou como migration

ALTER TABLE IF EXISTS public.service_requests
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

ALTER TABLE IF EXISTS public.service_requests
  ADD COLUMN IF NOT EXISTS blocked_by TEXT;

ALTER TABLE IF EXISTS public.service_requests
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

ALTER TABLE IF EXISTS public.service_requests
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

-- Opcional: criar índice para consultas por bloqueio
CREATE INDEX IF NOT EXISTS idx_service_requests_is_blocked ON public.service_requests(is_blocked);
