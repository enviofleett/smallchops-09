-- Create a diagnostic function to test authentication context
CREATE OR REPLACE FUNCTION public.test_admin_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_email text;
  is_recognized_admin boolean;
  user_roles_count integer;
  profile_role text;
BEGIN
  -- Get current user info
  current_user_id := auth.uid();
  
  SELECT email INTO current_email 
  FROM auth.users 
  WHERE id = current_user_id;
  
  -- Test is_admin()
  is_recognized_admin := is_admin();
  
  -- Get user_roles count
  SELECT COUNT(*) INTO user_roles_count
  FROM user_roles
  WHERE user_id = current_user_id
  AND is_active = true;
  
  -- Get profile role
  SELECT role INTO profile_role
  FROM profiles
  WHERE id = current_user_id;
  
  RETURN jsonb_build_object(
    'auth_uid', current_user_id,
    'email', current_email,
    'is_admin_result', is_recognized_admin,
    'user_roles_count', user_roles_count,
    'profile_role', profile_role,
    'special_email_match', (current_email = 'toolbuxdev@gmail.com')
  );
END;
$$;

COMMENT ON FUNCTION public.test_admin_access() IS 'Diagnostic function to test admin authentication and role detection';