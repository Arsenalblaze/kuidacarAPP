CREATE OR REPLACE FUNCTION public.get_public_support_contact()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'supportContactName', COALESCE(value->>'supportContactName', ''),
    'supportContactPhone', COALESCE(value->>'supportContactPhone', '')
  )
  FROM public.system_settings
  WHERE key = 'system:settings'
$$;

REVOKE ALL ON FUNCTION public.get_public_support_contact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_support_contact() TO anon, authenticated;
