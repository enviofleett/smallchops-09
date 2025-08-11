-- Create admin user profile without foreign key constraint issues
-- Note: The actual auth.users entry must be created through Supabase Auth signup

-- Create a temporary admin profile entry that will be linked when the user signs up
-- This approach assumes the auth user will be created manually or through the signup process

-- First, let's check if we can insert without the foreign key by temporarily disabling it
-- Actually, let's create a proper admin invitation instead

-- Insert admin invitation for store@startersmallchops.com
INSERT INTO public.admin_invitations (
  id,
  email,
  role,
  status,
  invitation_token,
  expires_at,
  created_by,
  created_at
)
SELECT
  gen_random_uuid(),
  'store@startersmallchops.com',
  'admin'::user_role,
  'pending',
  encode(gen_random_bytes(32), 'hex'),
  now() + interval '7 days',
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1), -- Use first available admin
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_invitations 
  WHERE email = 'store@startersmallchops.com'
);

-- Create a function to set up admin permissions after user signup
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