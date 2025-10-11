-- Add fulfilment_support to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'fulfilment_support';

-- Update setup_admin_role_permissions function to include fulfilment_support
CREATE OR REPLACE FUNCTION public.setup_admin_role_permissions(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete existing permissions
  DELETE FROM user_permissions WHERE user_id = p_user_id;
  
  -- Insert permissions based on role
  IF p_role IN ('super_admin', 'store_owner') THEN
    -- Full access to everything
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    SELECT p_user_id, unnest(ARRAY[
      'dashboard','orders_view','categories_view','products_view','customers_view',
      'catering_bookings','delivery_zones','promotions_view','reports-sales','audit_logs','settings',
      'settings_admin_users','settings_admin_permissions','settings_payments_providers',
      'settings_communications_branding','settings_dev'
    ]), 'edit';
  
  ELSIF p_role IN ('admin', 'manager') THEN
    -- Admin/Manager: Most features except dev settings
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    SELECT p_user_id, unnest(ARRAY[
      'dashboard','orders_view','categories_view','products_view','customers_view',
      'catering_bookings','delivery_zones','promotions_view','reports-sales','settings',
      'settings_payments_providers','settings_communications_branding'
    ]), 'edit';
  
  ELSIF p_role IN ('support_staff', 'support_officer', 'staff') THEN
    -- Support staff: Orders and customers only
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    VALUES 
      (p_user_id, 'dashboard', 'view'),
      (p_user_id, 'orders_view', 'edit'),
      (p_user_id, 'customers_view', 'edit');
  
  ELSIF p_role = 'admin_manager' THEN
    -- Admin manager: Product and promotion management
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    SELECT p_user_id, unnest(ARRAY[
      'dashboard','products_view','categories_view','catering_bookings',
      'delivery_zones','promotions_view'
    ]), 'edit';
  
  ELSIF p_role = 'account_manager' THEN
    -- Account manager: Financial oversight
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    SELECT p_user_id, unnest(ARRAY[
      'dashboard','orders_view','reports-sales'
    ]), 'edit';
  
  ELSIF p_role = 'fulfilment_support' THEN
    -- Fulfilment support: Only Driver Revenue and Delivery Fees reports (view only)
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    VALUES 
      (p_user_id, 'reports-sales', 'view'),
      (p_user_id, 'reports_driver_revenue', 'view'),
      (p_user_id, 'reports_delivery_fees', 'view');
  END IF;
  
  -- Log the permission assignment
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
  VALUES (
    'permissions_auto_assigned',
    'Permission Management',
    'Permissions auto-assigned for role: ' || p_role || ' (Production Fix)',
    p_user_id,
    p_user_id,
    jsonb_build_object('role', p_role, 'timestamp', now(), 'source', 'production_fix_migration')
  );
END;
$function$;