CREATE OR REPLACE FUNCTION public.get_admin_data_usage_summary()
RETURNS TABLE (
  category text,
  table_name text,
  rows bigint,
  size_bytes bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 'service_requests', 'public.service_requests', COUNT(*)::bigint, COALESCE(pg_total_relation_size('public.service_requests'), 0)::bigint
  FROM public.service_requests;

  RETURN QUERY
  SELECT 'messages', 'public.messages', COUNT(*)::bigint, COALESCE(pg_total_relation_size('public.messages'), 0)::bigint
  FROM public.messages;

  RETURN QUERY
  SELECT 'profiles', 'public.profiles', COUNT(*)::bigint, COALESCE(pg_total_relation_size('public.profiles'), 0)::bigint
  FROM public.profiles;

  RETURN QUERY
  SELECT 'notifications', 'public.kv_store_9dc5328a', COUNT(*)::bigint, COALESCE(pg_total_relation_size('public.kv_store_9dc5328a'), 0)::bigint
  FROM public.kv_store_9dc5328a
  WHERE key LIKE 'notification:%';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_storage_usage_total()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (
      SELECT SUM(size_bytes)
      FROM public.get_admin_data_usage_summary()
    ),
    0
  )::bigint;
$$;
