-- Secure user_permissions RLS and policies (fixed)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_permissions'
  ) THEN
    -- Enable RLS
    ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

    -- Reset existing relevant policies
    DROP POLICY IF EXISTS "Admins manage user_permissions" ON public.user_permissions;
    DROP POLICY IF EXISTS "Users can view their permissions" ON public.user_permissions;

    -- Admins manage all
    CREATE POLICY "Admins manage user_permissions"
      ON public.user_permissions
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());

    -- Users can only read their own permissions
    CREATE POLICY "Users can view their permissions"
      ON public.user_permissions
      FOR SELECT
      USING (user_id = auth.uid());
  ELSE
    RAISE NOTICE 'Table public.user_permissions not found, skipping RLS setup.';
  END IF;
END $$;