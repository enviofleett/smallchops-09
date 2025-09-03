-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS get_admin_users_secure();
DROP FUNCTION IF EXISTS get_menu_structure_secure();
DROP FUNCTION IF EXISTS get_user_permissions_secure(uuid);
DROP FUNCTION IF EXISTS update_user_permissions_secure(uuid, jsonb);
DROP FUNCTION IF EXISTS check_permission_change_rate_limit(uuid, integer);
DROP FUNCTION IF EXISTS record_permission_change_rate_limit(uuid, integer);

-- Create secure RPC functions for user permissions management

-- Function to get admin users securely
CREATE OR REPLACE FUNCTION get_admin_users_secure()
RETURNS TABLE (
  id uuid,
  name text,
  role user_role,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Log the access
  INSERT INTO audit_logs (
    action, category, message, user_id
  ) VALUES (
    'admin_users_accessed',
    'Permission Management', 
    'Admin users list accessed',
    auth.uid()
  );

  RETURN QUERY
  SELECT p.id, p.name, p.role, p.is_active
  FROM profiles p
  WHERE p.role IN ('admin', 'manager')
    AND p.is_active = true
  ORDER BY p.name;
END;
$$;

-- Function to get menu structure securely
CREATE OR REPLACE FUNCTION get_menu_structure_secure()
RETURNS TABLE (
  id uuid,
  key text,
  label text,
  parent_key text,
  sort_order integer,
  is_active boolean,
  permission_levels jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow authenticated users (will be further restricted by RLS)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Only allow admins to call this function
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  RETURN QUERY
  SELECT ms.id, ms.key, ms.label, ms.parent_key, ms.sort_order, ms.is_active, ms.permission_levels
  FROM menu_structure ms
  WHERE ms.is_active = true
  ORDER BY ms.sort_order;
END;
$$;

-- Function to get user permissions securely
CREATE OR REPLACE FUNCTION get_user_permissions_secure(target_user_id uuid)
RETURNS TABLE (
  menu_key text,
  permission_level permission_level
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Input validation
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;

  -- Only allow admins to call this function
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Verify target user exists and is admin/manager
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = target_user_id 
      AND role IN ('admin', 'manager')
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Target user not found or not authorized for permission management';
  END IF;

  -- Log the access
  INSERT INTO audit_logs (
    action, category, message, user_id, entity_id
  ) VALUES (
    'user_permissions_accessed',
    'Permission Management',
    'User permissions accessed for user: ' || target_user_id,
    auth.uid(),
    target_user_id
  );

  RETURN QUERY
  SELECT up.menu_key, up.permission_level
  FROM user_permissions up
  WHERE up.user_id = target_user_id;
END;
$$;

-- Function to update user permissions securely
CREATE OR REPLACE FUNCTION update_user_permissions_secure(
  target_user_id uuid,
  permissions_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_admin_id uuid;
  permission_key text;
  permission_value text;
  changes_count integer := 0;
  old_permissions jsonb;
BEGIN
  -- Get current admin user
  current_admin_id := auth.uid();
  
  -- Input validation
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  IF permissions_data IS NULL THEN
    RAISE EXCEPTION 'Permissions data cannot be null';
  END IF;

  -- Only allow admins to call this function
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Verify target user exists and is admin/manager
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = target_user_id 
      AND role IN ('admin', 'manager')
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Target user not found or not authorized for permission management';
  END IF;

  -- Store old permissions for audit log
  SELECT jsonb_agg(
    jsonb_build_object(
      'menu_key', menu_key,
      'permission_level', permission_level
    )
  ) INTO old_permissions
  FROM user_permissions
  WHERE user_id = target_user_id;

  -- Delete existing permissions for the user
  DELETE FROM user_permissions WHERE user_id = target_user_id;

  -- Insert new permissions from jsonb object
  FOR permission_key, permission_value IN SELECT * FROM jsonb_each_text(permissions_data)
  LOOP
    -- Validate permission level
    IF permission_value NOT IN ('none', 'view', 'edit') THEN
      RAISE EXCEPTION 'Invalid permission level: %', permission_value;
    END IF;
    
    -- Only insert non-'none' permissions
    IF permission_value != 'none' THEN
      INSERT INTO user_permissions (user_id, menu_key, permission_level)
      VALUES (target_user_id, permission_key, permission_value::permission_level);
      changes_count := changes_count + 1;
    END IF;
  END LOOP;

  -- Log the permission update
  INSERT INTO audit_logs (
    action, category, message, user_id, entity_id, old_values, new_values
  ) VALUES (
    'user_permissions_updated',
    'Permission Management',
    'User permissions updated for: ' || target_user_id || ' (' || changes_count || ' permissions set)',
    current_admin_id,
    target_user_id,
    old_permissions,
    permissions_data
  );

  RETURN jsonb_build_object(
    'success', true,
    'changes_count', changes_count,
    'message', 'Permissions updated successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO audit_logs (
      action, category, message, user_id, entity_id, new_values
    ) VALUES (
      'user_permissions_update_failed',
      'Permission Management',
      'Failed to update permissions for user: ' || target_user_id || ' - ' || SQLERRM,
      current_admin_id,
      target_user_id,
      jsonb_build_object('error', SQLERRM, 'permissions_data', permissions_data)
    );
    
    RAISE;
END;
$$;