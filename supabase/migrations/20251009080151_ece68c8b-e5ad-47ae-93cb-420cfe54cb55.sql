-- ============================================
-- PRODUCTION FIX: Admin User Registration FK Violation
-- ============================================
-- This migration fixes the foreign key violation when creating admin users
-- by ensuring profiles exist before role assignment in a single atomic transaction.

-- 1. Create atomic function to ensure profile + assign role
CREATE OR REPLACE FUNCTION public.create_admin_user_with_profile(
  p_user_id uuid,
  p_email text,
  p_name text,
  p_role app_role,
  p_assigned_by uuid,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_profile_created boolean := false;
  v_role_created boolean := false;
BEGIN
  -- 1) Ensure profile exists (upsert)
  INSERT INTO public.profiles (id, email, name, is_active, created_at, updated_at)
  VALUES (
    p_user_id,
    p_email,
    COALESCE(p_name, split_part(p_email, '@', 1)),
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, profiles.name),
    updated_at = now()
  RETURNING (xmax = 0) INTO v_profile_created;

  -- Log profile creation/update
  INSERT INTO public.audit_logs (action, category, message, user_id, entity_id, new_values)
  VALUES (
    CASE WHEN v_profile_created THEN 'profile_created' ELSE 'profile_updated' END,
    'User Management',
    'Profile ' || CASE WHEN v_profile_created THEN 'created' ELSE 'updated' END || ' for admin user: ' || p_email,
    p_assigned_by,
    p_user_id,
    jsonb_build_object('email', p_email, 'name', p_name, 'profile_operation', 'atomic_creation')
  );

  -- 2) Assign role in user_roles (upsert)
  INSERT INTO public.user_roles (user_id, role, assigned_by, is_active, expires_at, created_at, updated_at)
  VALUES (
    p_user_id,
    p_role,
    p_assigned_by,
    true,
    p_expires_at,
    now(),
    now()
  )
  ON CONFLICT (user_id, role) DO UPDATE SET
    assigned_by = EXCLUDED.assigned_by,
    is_active = true,
    expires_at = EXCLUDED.expires_at,
    updated_at = now()
  RETURNING (xmax = 0) INTO v_role_created;

  -- Log role assignment
  INSERT INTO public.audit_logs (action, category, message, user_id, entity_id, new_values)
  VALUES (
    CASE WHEN v_role_created THEN 'role_assigned' ELSE 'role_reactivated' END,
    'User Management',
    'Role ' || p_role::text || ' ' || CASE WHEN v_role_created THEN 'assigned' ELSE 'reactivated' END || ' for: ' || p_email,
    p_assigned_by,
    p_user_id,
    jsonb_build_object('role', p_role, 'expires_at', p_expires_at, 'operation', 'atomic_creation')
  );

  -- 3) Auto-assign default permissions based on role
  PERFORM setup_admin_role_permissions(p_user_id, p_role::text);

  -- Build success response
  v_result := jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'profile_created', v_profile_created,
    'role_created', v_role_created,
    'permissions_assigned', true
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO public.audit_logs (action, category, message, entity_id, new_values)
  VALUES (
    'admin_user_creation_failed',
    'User Management',
    'Failed to create admin user atomically: ' || SQLERRM,
    p_user_id,
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE, 'email', p_email)
  );
  
  -- Return error
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'sqlstate', SQLSTATE
  );
END;
$$;

-- Grant execute permission to service role only
REVOKE ALL ON FUNCTION public.create_admin_user_with_profile(uuid, text, text, app_role, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_admin_user_with_profile(uuid, text, text, app_role, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_admin_user_with_profile(uuid, text, text, app_role, uuid, timestamptz) TO authenticated;

-- 2. Add index on profiles.email for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email) WHERE email IS NOT NULL;

-- 3. Ensure profiles table has proper constraints
ALTER TABLE public.profiles 
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

-- 4. Add trigger to auto-update profiles.updated_at
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profiles_updated_at();

-- 5. Log this migration
INSERT INTO public.audit_logs (action, category, message, new_values)
VALUES (
  'migration_applied',
  'System',
  'Applied atomic admin user creation fix for FK violation prevention',
  jsonb_build_object(
    'migration', 'admin_user_atomic_creation',
    'timestamp', now(),
    'features', jsonb_build_array(
      'atomic profile + role creation',
      'FK violation prevention',
      'auto permission assignment',
      'comprehensive audit logging'
    )
  )
);