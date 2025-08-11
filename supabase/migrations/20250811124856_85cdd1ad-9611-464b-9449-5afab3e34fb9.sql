-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON profiles;

-- Recreate profiles policies with proper security definer functions
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can manage profiles" ON profiles
  FOR ALL USING (is_admin());

-- Additional admin management functions
CREATE OR REPLACE FUNCTION deactivate_admin_user(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    RETURN json_build_object('success', false, 'error', 'Cannot deactivate yourself');
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
$$;

CREATE OR REPLACE FUNCTION activate_admin_user(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

  -- Update user status
  UPDATE profiles
  SET is_active = true, updated_at = NOW()
  WHERE id = p_user_id;

  -- Log the action
  INSERT INTO audit_logs (
    action, category, message, user_id, entity_id, old_values, new_values
  ) VALUES (
    'admin_user_activated',
    'User Management',
    'Admin user activated: ' || target_user.email,
    auth.uid(),
    p_user_id,
    json_build_object('is_active', target_user.is_active),
    json_build_object('is_active', true)
  );

  RETURN json_build_object('success', true, 'message', 'User activated successfully');
END;
$$;

CREATE OR REPLACE FUNCTION update_admin_role(p_user_id UUID, p_new_role TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user RECORD;
  old_role TEXT;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Validate role
  IF p_new_role NOT IN ('admin', 'user') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid role');
  END IF;

  -- Get target user info
  SELECT * INTO target_user FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  old_role := target_user.role;

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
    'Role updated for user: ' || target_user.email || ' from ' || old_role || ' to ' || p_new_role,
    auth.uid(),
    p_user_id,
    json_build_object('role', old_role),
    json_build_object('role', p_new_role)
  );

  RETURN json_build_object('success', true, 'message', 'Role updated successfully');
END;
$$;