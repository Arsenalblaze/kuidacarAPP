INSERT INTO public.system_settings (key, value)
VALUES (
  'system:settings',
  jsonb_build_object('paymentIban', '0000 0055 3033 2012 1011 7')
)
ON CONFLICT (key)
DO UPDATE SET
  value = jsonb_set(
    COALESCE(public.system_settings.value, '{}'::jsonb),
    '{paymentIban}',
    EXCLUDED.value->'paymentIban',
    true
  ),
  updated_at = now();
