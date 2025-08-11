-- Create admin permissions setup for store@startersmallchops.com
-- This will automatically assign permissions when the user signs up

-- Create a function to set up admin permissions
CREATE OR REPLACE FUNCTION public.setup_admin_permissions(admin_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert permissions for all main menu items except settings
  INSERT INTO public.user_permissions (user_id, menu_key, permission_level, menu_section, sub_menu_section)
  VALUES
    -- Dashboard permissions
    (admin_user_id, 'dashboard', 'edit', 'main', null),
    
    -- Products permissions
    (admin_user_id, 'products', 'edit', 'main', null),
    (admin_user_id, 'product_list', 'edit', 'products', null),
    (admin_user_id, 'product_categories', 'edit', 'products', null),
    (admin_user_id, 'inventory', 'edit', 'products', null),
    
    -- Orders permissions
    (admin_user_id, 'orders', 'edit', 'main', null),
    (admin_user_id, 'order_list', 'edit', 'orders', null),
    (admin_user_id, 'order_tracking', 'edit', 'orders', null),
    (admin_user_id, 'order_management', 'edit', 'orders', null),
    
    -- Customer permissions
    (admin_user_id, 'customers', 'edit', 'main', null),
    (admin_user_id, 'customer_list', 'edit', 'customers', null),
    (admin_user_id, 'customer_analytics', 'edit', 'customers', null),
    
    -- Reports permissions
    (admin_user_id, 'reports', 'edit', 'main', null),
    (admin_user_id, 'sales_reports', 'edit', 'reports', null),
    (admin_user_id, 'revenue_reports', 'edit', 'reports', null),
    (admin_user_id, 'analytics', 'edit', 'reports', null),
    
    -- Marketing permissions
    (admin_user_id, 'marketing', 'edit', 'main', null),
    (admin_user_id, 'campaigns', 'edit', 'marketing', null),
    (admin_user_id, 'promotions', 'edit', 'marketing', null),
    (admin_user_id, 'email_marketing', 'edit', 'marketing', null),
    
    -- Content permissions
    (admin_user_id, 'content', 'edit', 'main', null),
    (admin_user_id, 'blog', 'edit', 'content', null),
    (admin_user_id, 'pages', 'edit', 'content', null),
    (admin_user_id, 'media', 'edit', 'content', null),
    
    -- Operations permissions
    (admin_user_id, 'operations', 'edit', 'main', null),
    (admin_user_id, 'delivery', 'edit', 'operations', null),
    (admin_user_id, 'inventory_management', 'edit', 'operations', null),
    (admin_user_id, 'staff_management', 'edit', 'operations', null)
  ON CONFLICT (user_id, menu_key) DO NOTHING;
  
  -- Log the admin user creation
  INSERT INTO public.audit_logs (
    action,
    category,
    message,
    user_id,
    new_values
  ) VALUES (
    'admin_permissions_setup',
    'User Management',
    'Admin permissions setup for user with full access except settings',
    admin_user_id,
    jsonb_build_object(
      'permissions_granted', 'all_except_settings',
      'total_permissions', 28
    )
  );
END;
$$;

-- Function to automatically set up admin after profile creation
CREATE OR REPLACE FUNCTION public.handle_admin_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if this is the store admin email
  IF NEW.email = 'store@startersmallchops.com' AND NEW.role = 'admin' THEN
    -- Set up permissions
    PERFORM public.setup_admin_permissions(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic admin setup
DROP TRIGGER IF EXISTS trigger_admin_signup ON public.profiles;
CREATE TRIGGER trigger_admin_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_signup();

-- Create a manual function to setup permissions for existing admin if needed
CREATE OR REPLACE FUNCTION public.manual_setup_store_admin()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_user_id uuid;
  result_text text;
BEGIN
  -- Find the admin user
  SELECT id INTO admin_user_id
  FROM public.profiles
  WHERE email = 'store@startersmallchops.com' AND role = 'admin';
  
  IF admin_user_id IS NOT NULL THEN
    -- Set up permissions
    PERFORM public.setup_admin_permissions(admin_user_id);
    result_text := 'Permissions setup completed for store@startersmallchops.com';
  ELSE
    result_text := 'Admin user store@startersmallchops.com not found. Please sign up first.';
  END IF;
  
  RETURN result_text;
END;
$$;