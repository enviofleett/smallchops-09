-- Create auto-permission assignment function
CREATE OR REPLACE FUNCTION public.setup_admin_role_permissions(
  p_user_id uuid, 
  p_role text
) RETURNS void AS $$
BEGIN
  -- Delete existing permissions
  DELETE FROM user_permissions WHERE user_id = p_user_id;
  
  -- Insert permissions based on role
  IF p_role = 'super_admin' THEN
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    SELECT p_user_id, unnest(ARRAY['dashboard','orders_view','categories_view','products_view','customers_view',
           'catering_bookings','delivery_zones','promotions_view','reports-sales','audit_logs','settings',
           'settings_admin_users','settings_admin_permissions','settings_payments_providers','settings_communications_branding','settings_dev']), 'edit';
  
  ELSIF p_role = 'store_owner' THEN
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    SELECT p_user_id, unnest(ARRAY['dashboard','orders_view','categories_view','products_view','customers_view',
           'catering_bookings','delivery_zones','promotions_view','reports-sales','audit_logs','settings',
           'settings_admin_users','settings_admin_permissions','settings_payments_providers','settings_communications_branding']), 'edit';
  
  ELSIF p_role = 'support_staff' THEN
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    VALUES 
      (p_user_id, 'dashboard', 'view'),
      (p_user_id, 'orders_view', 'edit'),
      (p_user_id, 'customers_view', 'edit');
  
  ELSIF p_role = 'admin_manager' THEN
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    SELECT p_user_id, unnest(ARRAY['dashboard','products_view','categories_view','catering_bookings',
           'delivery_zones','promotions_view']), 'edit';
  
  ELSIF p_role = 'account_manager' THEN
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    SELECT p_user_id, unnest(ARRAY['dashboard','orders_view','reports-sales']), 'edit';
  END IF;
  
  -- Log the permission assignment
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
  VALUES (
    'permissions_auto_assigned',
    'Permission Management',
    'Permissions auto-assigned for role: ' || p_role,
    p_user_id,
    p_user_id,
    jsonb_build_object('role', p_role, 'timestamp', now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger function for role changes
CREATE OR REPLACE FUNCTION trigger_setup_permissions_on_role_change()
RETURNS trigger AS $$
BEGIN
  PERFORM setup_admin_role_permissions(NEW.user_id, NEW.role::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS auto_assign_permissions_on_role_insert ON user_roles;
DROP TRIGGER IF EXISTS auto_assign_permissions_on_role_update ON user_roles;

-- Create triggers
CREATE TRIGGER auto_assign_permissions_on_role_insert
  AFTER INSERT ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_setup_permissions_on_role_change();

CREATE TRIGGER auto_assign_permissions_on_role_update
  AFTER UPDATE OF role ON user_roles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION trigger_setup_permissions_on_role_change();

-- Create function to check if user can create admins
CREATE OR REPLACE FUNCTION public.can_create_admin_users(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'store_owner')
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.setup_admin_role_permissions(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_admin_users(uuid) TO authenticated;