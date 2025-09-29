-- Enhanced admin setup and audit fix for toolbuxdev@gmail.com
-- This migration ensures comprehensive admin privileges and audit logging

-- First, ensure the profiles table has all necessary fields
DO $$ 
BEGIN 
    -- Add email column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE profiles ADD COLUMN email text;
    END IF;
    
    -- Add is_active column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_active') THEN
        ALTER TABLE profiles ADD COLUMN is_active boolean DEFAULT true;
    END IF;
    
    -- Add status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'status') THEN
        ALTER TABLE profiles ADD COLUMN status text DEFAULT 'active';
    END IF;
END $$;

-- Ensure toolbuxdev@gmail.com profile exists with guaranteed admin access
INSERT INTO profiles (id, email, role, status, is_active, name, created_at, updated_at)
VALUES (
  'b29ca05f-71b3-4159-a7e9-f33f45488285'::uuid,
  'toolbuxdev@gmail.com',
  'admin'::user_role,
  'active',
  true,
  'ToolBux Admin - Guaranteed Access',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  email = 'toolbuxdev@gmail.com',
  role = 'admin'::user_role,
  status = 'active',
  is_active = true,
  name = 'ToolBux Admin - Guaranteed Access',
  updated_at = NOW();

-- Ensure comprehensive admin permissions for toolbuxdev@gmail.com
INSERT INTO user_permissions (id, user_id, menu_key, permission_level, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'b29ca05f-71b3-4159-a7e9-f33f45488285'::uuid,
  menu_key,
  'edit'::permission_level,
  NOW(),
  NOW()
FROM (
  VALUES 
    ('settings_admin_users'),
    ('settings_business'),
    ('settings_payments'),
    ('settings_delivery'),
    ('settings_communications'),
    ('orders_management'),
    ('products_management'),
    ('customers_management'),
    ('analytics_dashboard'),
    ('content_management'),
    ('drivers_management'),
    ('delivery_zones'),
    ('orders'),
    ('categories'),
    ('products'),
    ('customers'),
    ('promotions'),
    ('reports'),
    ('delivery'),
    ('admin_panel'),
    ('system_settings'),
    ('audit_logs'),
    ('user_management')
) AS admin_menus(menu_key)
ON CONFLICT (user_id, menu_key) DO UPDATE SET
  permission_level = 'edit'::permission_level,
  updated_at = NOW();

-- Create audit log entry for this security enhancement
INSERT INTO audit_logs (
  action,
  category,
  message,
  user_id,
  new_values,
  created_at
) VALUES (
  'toolbux_admin_setup_complete',
  'Security',
  'ToolBux admin privileges configured with guaranteed access and comprehensive permissions',
  'b29ca05f-71b3-4159-a7e9-f33f45488285'::uuid,
  jsonb_build_object(
    'admin_email', 'toolbuxdev@gmail.com',
    'permissions_count', (SELECT count(*) FROM user_permissions WHERE user_id = 'b29ca05f-71b3-4159-a7e9-f33f45488285'::uuid),
    'setup_timestamp', NOW(),
    'guaranteed_access', true,
    'audit_system_enabled', true
  ),
  NOW()
);

-- Update the handle_new_user function to handle both admin emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Check if this is one of the guaranteed admin emails
  IF NEW.email IN ('chudesyl@gmail.com', 'toolbuxdev@gmail.com') THEN
    INSERT INTO public.profiles (id, name, email, role, is_active, status, created_at, updated_at)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'name', 'Admin User'), 
      NEW.email,
      'admin', 
      true,
      'active',
      NOW(),
      NOW()
    );
    
    -- Log the admin user creation
    INSERT INTO audit_logs (
      action,
      category,
      message,
      user_id,
      new_values
    ) VALUES (
      'guaranteed_admin_created',
      'Security',
      'Guaranteed admin user created: ' || NEW.email,
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'guaranteed_admin', true,
        'created_at', NOW()
      )
    );
  ELSE
    INSERT INTO public.profiles (id, name, role)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'name', 'staff');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create indexes for better performance on admin operations
CREATE INDEX IF NOT EXISTS idx_profiles_email_role ON profiles(email, role) WHERE role = 'admin';
CREATE INDEX IF NOT EXISTS idx_user_permissions_admin ON user_permissions(user_id, menu_key) WHERE permission_level = 'edit';
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_actions ON audit_logs(action, user_id, created_at) WHERE category = 'Security';

-- Final audit log
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'authentication_audit_fix_complete',
  'Security',
  'Comprehensive authentication audit and fix completed with enhanced security logging',
  jsonb_build_object(
    'migration_completed_at', NOW(),
    'toolbux_admin_configured', true,
    'audit_system_enhanced', true,
    'permission_system_updated', true,
    'security_hardening_complete', true
  )
);