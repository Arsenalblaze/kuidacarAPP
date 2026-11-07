ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS provider_location JSONB,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_method TEXT;
