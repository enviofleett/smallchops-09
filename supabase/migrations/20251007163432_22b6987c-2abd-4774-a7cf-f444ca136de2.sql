-- Add missing roles to the app_role enum
DO $$ 
BEGIN
  -- Add support_staff if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type t 
                 JOIN pg_enum e ON t.oid = e.enumtypid  
                 JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' 
                 AND t.typname = 'app_role' 
                 AND e.enumlabel = 'support_staff') THEN
    ALTER TYPE public.app_role ADD VALUE 'support_staff';
  END IF;

  -- Add admin_manager if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type t 
                 JOIN pg_enum e ON t.oid = e.enumtypid  
                 JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' 
                 AND t.typname = 'app_role' 
                 AND e.enumlabel = 'admin_manager') THEN
    ALTER TYPE public.app_role ADD VALUE 'admin_manager';
  END IF;

  -- Add account_manager if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type t 
                 JOIN pg_enum e ON t.oid = e.enumtypid  
                 JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' 
                 AND t.typname = 'app_role' 
                 AND e.enumlabel = 'account_manager') THEN
    ALTER TYPE public.app_role ADD VALUE 'account_manager';
  END IF;

  -- Add store_owner if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type t 
                 JOIN pg_enum e ON t.oid = e.enumtypid  
                 JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' 
                 AND t.typname = 'app_role' 
                 AND e.enumlabel = 'store_owner') THEN
    ALTER TYPE public.app_role ADD VALUE 'store_owner';
  END IF;
END $$;

-- Update setup_admin_role_permissions to handle new roles
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
$function$;