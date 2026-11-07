CREATE TABLE IF NOT EXISTS public.admin_data_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  table_name text NOT NULL,
  original_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_at timestamptz NOT NULL DEFAULT now(),
  source_created_at timestamptz,
  status text NOT NULL DEFAULT 'archived',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, table_name, original_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_data_archives_category
  ON public.admin_data_archives (category);

CREATE INDEX IF NOT EXISTS idx_admin_data_archives_archived_at
  ON public.admin_data_archives (archived_at);

ALTER TABLE public.admin_data_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_data_archives_select_authenticated ON public.admin_data_archives;
CREATE POLICY admin_data_archives_select_authenticated
  ON public.admin_data_archives
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS admin_data_archives_manage_super_admin ON public.admin_data_archives;
CREATE POLICY admin_data_archives_manage_super_admin
  ON public.admin_data_archives
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

CREATE OR REPLACE FUNCTION public.admin_data_archives_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_admin_data_archives ON public.admin_data_archives;
CREATE TRIGGER set_updated_at_admin_data_archives
BEFORE UPDATE ON public.admin_data_archives
FOR EACH ROW EXECUTE PROCEDURE public.admin_data_archives_updated_at();
