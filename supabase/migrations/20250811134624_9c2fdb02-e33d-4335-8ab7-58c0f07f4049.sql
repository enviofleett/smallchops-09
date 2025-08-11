-- Hardcode admin user setup for store@startersmallchops.com
-- This bypasses edge function issues and creates everything directly

-- Create a fixed UUID for the admin user that we'll use consistently
-- When they sign up with Supabase Auth, we'll link this profile to their auth user

-- First, let's create the profile with a predictable UUID
DO $$
DECLARE
  admin_user_uuid uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- Insert the hardcoded admin profile
  INSERT INTO public.profiles (
    id, 
    email, 
    role, 
    is_active, 
    created_at, 
    updated_at
  ) VALUES (
    admin_user_uuid,
    'store@startersmallchops.com',
    'admin'::user_role,
    true,
    now(),
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = now();

  -- Set up all admin permissions except settings
  DELETE FROM public.user_permissions WHERE user_id = admin_user_uuid;
  
  INSERT INTO public.user_permissions (user_id, menu_key, permission_level, menu_section, sub_menu_section)
  VALUES
    -- Dashboard permissions
    (admin_user_uuid, 'dashboard', 'edit', 'main', null),
    
    -- Products permissions
    (admin_user_uuid, 'products', 'edit', 'main', null),
    (admin_user_uuid, 'product_list', 'edit', 'products', null),
    (admin_user_uuid, 'product_categories', 'edit', 'products', null),
    (admin_user_uuid, 'inventory', 'edit', 'products', null),
    
    -- Orders permissions
    (admin_user_uuid, 'orders', 'edit', 'main', null),
    (admin_user_uuid, 'order_list', 'edit', 'orders', null),
    (admin_user_uuid, 'order_tracking', 'edit', 'orders', null),
    (admin_user_uuid, 'order_management', 'edit', 'orders', null),
    
    -- Customer permissions
    (admin_user_uuid, 'customers', 'edit', 'main', null),
    (admin_user_uuid, 'customer_list', 'edit', 'customers', null),
    (admin_user_uuid, 'customer_analytics', 'edit', 'customers', null),
    
    -- Reports permissions
    (admin_user_uuid, 'reports', 'edit', 'main', null),
    (admin_user_uuid, 'sales_reports', 'edit', 'reports', null),
    (admin_user_uuid, 'revenue_reports', 'edit', 'reports', null),
    (admin_user_uuid, 'analytics', 'edit', 'reports', null),
    
    -- Marketing permissions
    (admin_user_uuid, 'marketing', 'edit', 'main', null),
    (admin_user_uuid, 'campaigns', 'edit', 'marketing', null),
    (admin_user_uuid, 'promotions', 'edit', 'marketing', null),
    (admin_user_uuid, 'email_marketing', 'edit', 'marketing', null),
    
    -- Content permissions
    (admin_user_uuid, 'content', 'edit', 'main', null),
    (admin_user_uuid, 'blog', 'edit', 'content', null),
    (admin_user_uuid, 'pages', 'edit', 'content', null),
    (admin_user_uuid, 'media', 'edit', 'content', null),
    
    -- Operations permissions
    (admin_user_uuid, 'operations', 'edit', 'main', null),
    (admin_user_uuid, 'delivery', 'edit', 'operations', null),
    (admin_user_uuid, 'inventory_management', 'edit', 'operations', null),
    (admin_user_uuid, 'staff_management', 'edit', 'operations', null);

  -- Log the hardcoded admin creation
  INSERT INTO public.audit_logs (
    action,
    category,
    message,
    user_id,
    new_values
  ) VALUES (
    'hardcoded_admin_created',
    'User Management',
    'Hardcoded admin user created for store@startersmallchops.com with all permissions except settings',
    admin_user_uuid,
    jsonb_build_object(
      'email', 'store@startersmallchops.com',
      'role', 'admin',
      'permissions_granted', 'all_except_settings',
      'total_permissions', 28,
      'hardcoded', true
    )
  );
END $$;

-- Create a function to link the hardcoded profile when the user actually signs up
CREATE OR REPLACE FUNCTION public.link_hardcoded_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  hardcoded_uuid uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- If this is the store admin email signing up, update the hardcoded profile with their real auth ID
  IF NEW.email = 'store@startersmallchops.com' THEN
    -- Update the existing hardcoded profile with the real auth user ID
    UPDATE public.profiles 
    SET id = NEW.id,
        updated_at = now()
    WHERE id = hardcoded_uuid;
    
    -- Update all permissions to use the new user ID
    UPDATE public.user_permissions 
    SET user_id = NEW.id,
        updated_at = now()
    WHERE user_id = hardcoded_uuid;
    
    -- Update audit logs
    UPDATE public.audit_logs 
    SET user_id = NEW.id,
        new_values = new_values || jsonb_build_object('linked_auth_id', NEW.id)
    WHERE user_id = hardcoded_uuid;
    
    -- Create a new profile entry to prevent conflicts
    INSERT INTO public.profiles (
      id, email, role, is_active, created_at, updated_at
    ) VALUES (
      NEW.id, NEW.email, 'admin'::user_role, true, now(), now()
    ) ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active,
      updated_at = now();
      
    -- Log the linking
    INSERT INTO public.audit_logs (
      action,
      category,
      message,
      user_id,
      new_values
    ) VALUES (
      'hardcoded_admin_linked',
      'User Management',
      'Hardcoded admin profile linked to real auth user',
      NEW.id,
      jsonb_build_object(
        'original_uuid', hardcoded_uuid,
        'new_auth_id', NEW.id,
        'email', NEW.email
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for linking hardcoded admin
DROP TRIGGER IF EXISTS trigger_link_hardcoded_admin ON auth.users;
CREATE TRIGGER trigger_link_hardcoded_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_hardcoded_admin();