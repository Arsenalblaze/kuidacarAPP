CREATE TABLE IF NOT EXISTS public.user_login_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_login_sessions_started_at
  ON public.user_login_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_login_sessions_user_started_at
  ON public.user_login_sessions (user_id, started_at DESC);

ALTER TABLE public.user_login_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_login_sessions_insert_own ON public.user_login_sessions;
CREATE POLICY user_login_sessions_insert_own
  ON public.user_login_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_login_sessions_select_admins ON public.user_login_sessions;
CREATE POLICY user_login_sessions_select_admins
  ON public.user_login_sessions
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

GRANT INSERT, SELECT ON public.user_login_sessions TO authenticated;
