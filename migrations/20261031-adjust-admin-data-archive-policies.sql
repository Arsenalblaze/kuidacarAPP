DROP POLICY IF EXISTS admin_data_archives_insert_admin ON public.admin_data_archives;
CREATE POLICY admin_data_archives_insert_admin
  ON public.admin_data_archives
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS admin_data_archives_update_admin ON public.admin_data_archives;
CREATE POLICY admin_data_archives_update_admin
  ON public.admin_data_archives
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );
