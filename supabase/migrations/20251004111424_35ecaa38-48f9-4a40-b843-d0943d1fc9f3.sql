-- Fix admin management functions to work with edge function authentication
-- Since the edge function already checks admin status and uses service role key,
-- these functions don't need additional permission checks

DROP FUNCTION IF EXISTS public.deactivate_admin_user(uuid);
DROP FUNCTION IF EXISTS public.update_admin_role(uuid, text);
DROP FUNCTION IF EXISTS public.activate_admin_user(uuid);

-- Create deactivate_admin_user function (no permission check needed - called by authenticated edge function)
CREATE OR REPLACE FUNCTION public.deactivate_admin_user(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_user RECORD;
BEGIN
  -- Get target user info
  SELECT * INTO target_user FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Update user status
  UPDATE profiles
  SET is_active = false, updated_at = NOW()
  WHERE id = p_user_id;

  -- Log the action
  INSERT INTO audit_logs (
    action, category, message, entity_id, old_values, new_values
  ) VALUES (
    'admin_user_deactivated',
    'User Management',
    'Admin user deactivated: ' || target_user.email,
    p_user_id,
    json_build_object('is_active', target_user.is_active),
    json_build_object('is_active', false)
  );

  RETURN json_build_object('success', true, 'message', 'User deactivated successfully');
END;
$function$;

-- Create activate_admin_user function
CREATE OR REPLACE FUNCTION public.activate_admin_user(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_user RECORD;
BEGIN
  -- Get target user info
  SELECT * INTO target_user FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Update user status
  UPDATE profiles
  SET is_active = true, updated_at = NOW()
  WHERE id = p_user_id;

  -- Log the action
  INSERT INTO audit_logs (
    action, category, message, entity_id, old_values, new_values
  ) VALUES (
    'admin_user_activated',
    'User Management',
    'Admin user activated: ' || target_user.email,
    p_user_id,
    json_build_object('is_active', target_user.is_active),
    json_build_object('is_active', true)
  );

  RETURN json_build_object('success', true, 'message', 'User activated successfully');
END;
$function$;

-- Create update_admin_role function
CREATE OR REPLACE FUNCTION public.update_admin_role(p_user_id uuid, p_new_role text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_user RECORD;
  valid_roles text[] := ARRAY['admin', 'user', 'manager'];
BEGIN
  -- Validate role
  IF NOT p_new_role = ANY(valid_roles) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid role. Must be one of: admin, user, manager');
  END IF;

  -- Get target user info
  SELECT * INTO target_user FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Update user role
  UPDATE profiles
  SET role = p_new_role, updated_at = NOW()
  WHERE id = p_user_id;

  -- Log the action
  INSERT INTO audit_logs (
    action, category, message, entity_id, old_values, new_values
  ) VALUES (
    'admin_role_updated',
    'User Management',
    'Admin role updated: ' || target_user.email || ' from ' || target_user.role || ' to ' || p_new_role,
    p_user_id,
    json_build_object('role', target_user.role),
    json_build_object('role', p_new_role)
  );

  RETURN json_build_object('success', true, 'message', 'Role updated successfully');
END;
$function$;