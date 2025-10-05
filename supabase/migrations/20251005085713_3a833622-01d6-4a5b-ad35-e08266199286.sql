-- Fix is_admin() function to properly recognize super_admin role and toolbuxdev@gmail.com
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- CRITICAL: Always grant admin access to toolbuxdev@gmail.com
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'toolbuxdev@gmail.com'
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- Ensure toolbuxdev@gmail.com has super_admin role
INSERT INTO public.user_roles (user_id, role, is_active, assigned_by)
SELECT 
  id,
  'super_admin'::app_role,
  true,
  id
FROM auth.users
WHERE email = 'toolbuxdev@gmail.com'
ON CONFLICT (user_id, role) 
DO UPDATE SET 
  is_active = true,
  expires_at = NULL,
  updated_at = now();

-- Update profile to ensure admin role
UPDATE public.profiles
SET 
  role = 'admin',
  is_active = true,
  updated_at = now()
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'toolbuxdev@gmail.com'
);

COMMENT ON FUNCTION public.is_admin() IS 'Production-ready admin check with super_admin support and toolbuxdev@gmail.com bypass';