-- Simple hardcoded solution: Set up automatic permissions for store@startersmallchops.com
-- This avoids foreign key issues and edge function problems

-- Create an enhanced trigger that sets up permissions for the hardcoded admin email
CREATE OR REPLACE FUNCTION public.setup_hardcoded_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if this is the hardcoded admin email
  IF NEW.email = 'store@startersmallchops.com' THEN
    -- Ensure the profile has admin role
    NEW.role := 'admin'::user_role;
    NEW.is_active := true;
    
    -- Set up all admin permissions except settings (this will happen after insert)
    -- We'll use a separate function called after the profile is created
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to set up permissions after profile creation
CREATE OR REPLACE FUNCTION public.setup_permissions_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if this is the hardcoded admin email
  IF NEW.email = 'store@startersmallchops.com' AND NEW.role = 'admin' THEN
    -- Set up all admin permissions except settings
    INSERT INTO public.user_permissions (user_id, menu_key, permission_level, menu_section, sub_menu_section)
    VALUES
      -- Dashboard permissions
      (NEW.id, 'dashboard', 'edit', 'main', null),
      
      -- Products permissions
      (NEW.id, 'products', 'edit', 'main', null),
      (NEW.id, 'product_list', 'edit', 'products', null),
      (NEW.id, 'product_categories', 'edit', 'products', null),
      (NEW.id, 'inventory', 'edit', 'products', null),
      
      -- Orders permissions
      (NEW.id, 'orders', 'edit', 'main', null),
      (NEW.id, 'order_list', 'edit', 'orders', null),
      (NEW.id, 'order_tracking', 'edit', 'orders', null),
      (NEW.id, 'order_management', 'edit', 'orders', null),
      
      -- Customer permissions
      (NEW.id, 'customers', 'edit', 'main', null),
      (NEW.id, 'customer_list', 'edit', 'customers', null),
      (NEW.id, 'customer_analytics', 'edit', 'customers', null),
      
      -- Reports permissions
      (NEW.id, 'reports', 'edit', 'main', null),
      (NEW.id, 'sales_reports', 'edit', 'reports', null),
      (NEW.id, 'revenue_reports', 'edit', 'reports', null),
      (NEW.id, 'analytics', 'edit', 'reports', null),
      
      -- Marketing permissions
      (NEW.id, 'marketing', 'edit', 'main', null),
      (NEW.id, 'campaigns', 'edit', 'marketing', null),
      (NEW.id, 'promotions', 'edit', 'marketing', null),
      (NEW.id, 'email_marketing', 'edit', 'marketing', null),
      
      -- Content permissions
      (NEW.id, 'content', 'edit', 'main', null),
      (NEW.id, 'blog', 'edit', 'content', null),
      (NEW.id, 'pages', 'edit', 'content', null),
      (NEW.id, 'media', 'edit', 'content', null),
      
      -- Operations permissions
      (NEW.id, 'operations', 'edit', 'main', null),
      (NEW.id, 'delivery', 'edit', 'operations', null),
      (NEW.id, 'inventory_management', 'edit', 'operations', null),
      (NEW.id, 'staff_management', 'edit', 'operations', null)
    ON CONFLICT (user_id, menu_key) DO NOTHING;

    -- Log the hardcoded admin creation
    INSERT INTO public.audit_logs (
      action,
      category,
      message,
      user_id,
      new_values
    ) VALUES (
      'hardcoded_admin_setup',
      'User Management',
      'Hardcoded admin user setup for store@startersmallchops.com with all permissions except settings',
      NEW.id,
      jsonb_build_object(
        'email', 'store@startersmallchops.com',
        'role', 'admin',
        'permissions_granted', 'all_except_settings',
        'total_permissions', 28,
        'hardcoded', true
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS trigger_admin_signup ON public.profiles;
DROP TRIGGER IF EXISTS trigger_link_hardcoded_admin ON auth.users;

-- Create triggers for the hardcoded admin setup
CREATE TRIGGER trigger_setup_hardcoded_admin
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.setup_hardcoded_admin();

CREATE TRIGGER trigger_permissions_after_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.setup_permissions_after_insert();