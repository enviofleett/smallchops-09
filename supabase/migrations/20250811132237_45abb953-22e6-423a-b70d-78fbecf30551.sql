-- Create admin user and permissions for store@startersmallchops.com

-- First, insert the admin user into auth.users (this will be handled by Supabase Auth)
-- Instead, we'll create a profile and assume the auth user will be created manually

-- Insert admin profile
INSERT INTO public.profiles (id, email, role, is_active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'store@startersmallchops.com',
  'admin'::user_role,
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE email = 'store@startersmallchops.com'
);

-- Create user permissions for all pages except settings
-- Get the user ID for the admin user
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Get the admin user ID
  SELECT id INTO admin_user_id 
  FROM public.profiles 
  WHERE email = 'store@startersmallchops.com';
  
  IF admin_user_id IS NOT NULL THEN
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
      'admin_user_created',
      'User Management',
      'Admin user created for store@startersmallchops.com with full permissions except settings',
      admin_user_id,
      jsonb_build_object(
        'email', 'store@startersmallchops.com',
        'role', 'admin',
        'permissions_granted', 'all_except_settings'
      )
    );
  END IF;
END $$;