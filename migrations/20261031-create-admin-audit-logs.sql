CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text,
  actor_email text,
  actor_role text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  description text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_id
  ON public.admin_audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action
  ON public.admin_audit_logs (action);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_logs_select_admins ON public.admin_audit_logs;
CREATE POLICY admin_audit_logs_select_admins
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS admin_audit_logs_insert_as_admin ON public.admin_audit_logs;
CREATE POLICY admin_audit_logs_insert_as_admin
  ON public.admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND actor_role = (
      SELECT p.role
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_admin_row_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_record public.profiles%ROWTYPE;
  old_row jsonb := '{}'::jsonb;
  new_row jsonb := '{}'::jsonb;
  changed_columns text[] := ARRAY[]::text[];
  audit_action text;
  audit_description text;
  entity_id_value text;
  audit_details jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_row := to_jsonb(OLD);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_row := to_jsonb(NEW);
  END IF;

  IF actor IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT p.*
    INTO actor_record
    FROM public.profiles p
    WHERE p.id = actor;

  IF COALESCE(actor_record.role, '') NOT IN ('admin', 'super_admin') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(array_agg(key), ARRAY[]::text[])
      INTO changed_columns
      FROM jsonb_object_keys(new_row) AS columns(key);
  ELSIF TG_OP = 'DELETE' THEN
    SELECT COALESCE(array_agg(key), ARRAY[]::text[])
      INTO changed_columns
      FROM jsonb_object_keys(old_row) AS columns(key);
  ELSE
    SELECT COALESCE(array_agg(key), ARRAY[]::text[])
      INTO changed_columns
      FROM jsonb_object_keys(new_row) AS columns(key)
      WHERE (old_row -> key) IS DISTINCT FROM (new_row -> key);
  END IF;

  IF TG_TABLE_NAME = 'profiles' THEN
    IF TG_OP <> 'UPDATE'
      OR NOT (changed_columns && ARRAY['supervision_admin_id', 'role', 'is_blocked', 'is_active', 'is_verified']::text[]) THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END IF;

    entity_id_value := new_row ->> 'id';
    IF 'supervision_admin_id' = ANY(changed_columns) THEN
      audit_action := 'supervision.assignment';
      audit_description := 'Alterou as permissões de supervisão de um utilizador.';
    ELSIF 'role' = ANY(changed_columns) THEN
      audit_action := 'admin.role.change';
      audit_description := 'Alterou o perfil de acesso de um utilizador.';
    ELSE
      audit_action := 'profile.access.change';
      audit_description := 'Alterou o estado ou as permissões de um utilizador.';
    END IF;

    audit_details := jsonb_build_object(
      'changedFields', to_jsonb(changed_columns),
      'previousAdminId', old_row ->> 'supervision_admin_id',
      'nextAdminId', new_row ->> 'supervision_admin_id',
      'previousRole', old_row ->> 'role',
      'nextRole', new_row ->> 'role',
      'previousBlocked', old_row ->> 'is_blocked',
      'nextBlocked', new_row ->> 'is_blocked',
      'previousActive', old_row ->> 'is_active',
      'nextActive', new_row ->> 'is_active'
    );
  ELSE
    entity_id_value := COALESCE(new_row ->> 'id', old_row ->> 'id');
    audit_action := 'service_request.' || lower(TG_OP);
    audit_description := CASE
      WHEN TG_OP = 'UPDATE' AND old_row ->> 'status' IS DISTINCT FROM new_row ->> 'status'
        THEN 'Alterou o estado de uma solicitação de serviço.'
      WHEN TG_OP = 'INSERT' THEN 'Criou uma solicitação de serviço.'
      WHEN TG_OP = 'DELETE' THEN 'Removeu uma solicitação de serviço.'
      ELSE 'Alterou uma solicitação de serviço.'
    END;
    audit_details := jsonb_build_object(
      'changedFields', to_jsonb(changed_columns),
      'previousStatus', old_row ->> 'status',
      'nextStatus', new_row ->> 'status'
    );
  END IF;

  INSERT INTO public.admin_audit_logs (
    actor_id, actor_name, actor_email, actor_role, action,
    entity_type, entity_id, description, details
  ) VALUES (
    actor,
    COALESCE(NULLIF(actor_record.name, ''), actor_record.email, 'Administrador'),
    COALESCE(actor_record.email, ''),
    actor_record.role,
    audit_action,
    CASE WHEN TG_TABLE_NAME = 'profiles' THEN 'profile' ELSE 'service_request' END,
    entity_id_value,
    audit_description,
    audit_details
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_admin_profile_updates ON public.profiles;
CREATE TRIGGER audit_admin_profile_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_row_changes();

DROP TRIGGER IF EXISTS audit_admin_service_request_changes ON public.service_requests;
CREATE TRIGGER audit_admin_service_request_changes
AFTER INSERT OR UPDATE OR DELETE ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_row_changes();
