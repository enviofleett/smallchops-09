-- Create deactivate_admin_user function
CREATE OR REPLACE FUNCTION public.deactivate_admin_user(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_user RECORD;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Get target user info
  SELECT * INTO target_user FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Prevent self-deactivation
  IF p_user_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Cannot deactivate your own account');
  END IF;

  -- Update user status
  UPDATE profiles
  SET is_active = false, updated_at = NOW()
  WHERE id = p_user_id;

  -- Log the action
  INSERT INTO audit_logs (
    action, category, message, user_id, entity_id, old_values, new_values
  ) VALUES (
    'admin_user_deactivated',
    'User Management',
    'Admin user deactivated: ' || target_user.email,
    auth.uid(),
    p_user_id,
    json_build_object('is_active', target_user.is_active),
    json_build_object('is_active', false)
  );

  RETURN json_build_object('success', true, 'message', 'User deactivated successfully');
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
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Validate role
  IF NOT p_new_role = ANY(valid_roles) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid role. Must be one of: admin, user, manager');
  END IF;

  -- Get target user info
  SELECT * INTO target_user FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Prevent self-role change to non-admin
  IF p_user_id = auth.uid() AND p_new_role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot change your own admin role');
  END IF;

  -- Update user role
  UPDATE profiles
  SET role = p_new_role, updated_at = NOW()
  WHERE id = p_user_id;

  -- Log the action
  INSERT INTO audit_logs (
    action, category, message, user_id, entity_id, old_values, new_values
  ) VALUES (
    'admin_role_updated',
    'User Management',
    'Admin role updated: ' || target_user.email || ' from ' || target_user.role || ' to ' || p_new_role,
    auth.uid(),
    p_user_id,
    json_build_object('role', target_user.role),
    json_build_object('role', p_new_role)
  );

  RETURN json_build_object('success', true, 'message', 'Role updated successfully');
END;
$function$;