-- Migration: create system_settings table to store platform settings (multicaixa number, etc.)

-- 1) Create table
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.system_settings_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_system_settings ON public.system_settings;
CREATE TRIGGER set_updated_at_system_settings
BEFORE UPDATE ON public.system_settings
FOR EACH ROW EXECUTE PROCEDURE public.system_settings_updated_at();

-- 3) Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 4) Policies
-- Allow any authenticated user to SELECT settings
CREATE POLICY select_system_settings_authenticated ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow only super_admins to INSERT/UPDATE/DELETE (manage) settings
CREATE POLICY manage_system_settings_super_admin ON public.system_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- 5) Insert default settings row (key: system:settings)
INSERT INTO public.system_settings (key, value)
VALUES (
  'system:settings',
  jsonb_build_object(
    'paymentMethodName', 'Multicaixa Express',
    'multicaixaNumber', '929630902',
    'adminNotice', 'Efetue o pagamento e envie a referência para confirmação.',
    'commissionPercentage', to_jsonb(15),
    'servicePricing', jsonb_build_object('geral', 0),
    'platformName', 'KuidaCar',
    'primaryColor', '#f97316',
    'supportEmail', '',
    'supportPhone', ''
  )
)
ON CONFLICT (key)
DO UPDATE SET value = EXCLUDED.value, updated_at = now();
