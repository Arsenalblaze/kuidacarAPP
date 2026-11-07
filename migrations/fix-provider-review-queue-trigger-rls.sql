-- Let the mechanic review trigger enqueue reviews without weakening table RLS.
CREATE OR REPLACE FUNCTION public.insert_provider_review_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.provider_review_queue (
    id,
    mechanic_id,
    customer_id,
    request_id,
    rating,
    comment,
    created_at,
    updated_at
  )
  VALUES (
    pg_catalog.gen_random_uuid()::text,
    NEW.mechanic_id,
    NEW.customer_id,
    NEW.service_id,
    NEW.rating,
    NEW.comment,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;
