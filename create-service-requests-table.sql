
-- Cria a tabela service_requests (usada pelo cliente direto ao Supabase)
CREATE TABLE IF NOT EXISTS public.service_requests (
	id TEXT PRIMARY KEY,
	customer_id TEXT,
	customer_phone TEXT,
	provider_id TEXT,
	mechanic_name TEXT,
	type TEXT NOT NULL,
	description TEXT,
	location JSONB,
	provider_location JSONB,
	estimated_price INTEGER,
	payment_reference TEXT,
	payment_amount NUMERIC(12, 2),
	payment_method TEXT,
	status TEXT DEFAULT 'pending',
	-- Campos para bloqueio por cliente ou prestador
	is_blocked BOOLEAN DEFAULT FALSE,
	blocked_by TEXT,
	blocked_reason TEXT,
	blocked_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ DEFAULT NOW(),
	updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON public.service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_provider ON public.service_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_customer ON public.service_requests(customer_id);
