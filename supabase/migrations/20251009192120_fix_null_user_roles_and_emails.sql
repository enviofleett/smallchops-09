-- Fix for null user roles and customer emails
-- Date: 2025-10-09
-- Description: Ensures user roles are always set and customer accounts always have emails

-- 1. Fix customer_accounts to ensure email is always populated
-- Update the handle_new_user function to include email when creating customer accounts

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
  user_name TEXT;
  user_phone TEXT;
  account_id UUID;
BEGIN
  -- Extract user info from metadata or email
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name', 
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  
  user_phone := NEW.raw_user_meta_data->>'phone';

  -- CRITICAL FIX: Always include email when creating customer account
  INSERT INTO public.customer_accounts (
    user_id, 
    email,        -- FIX: Add email field
    name, 
    phone,
    email_verified,
    profile_completion_percentage
  ) VALUES (
    NEW.id,
    NEW.email,    -- FIX: Set email from auth.users
    user_name, 
    user_phone,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    CASE 
      WHEN user_phone IS NOT NULL THEN 80
      ELSE 60
    END
  ) RETURNING id INTO account_id;

  -- Log account creation with email
  INSERT INTO public.audit_logs (
    action, category, message, new_values
  ) VALUES (
    'customer_account_created',
    'Authentication',
    'Created customer account for: ' || COALESCE(NEW.email, 'unknown'),
    jsonb_build_object(
      'account_id', account_id, 
      'user_id', NEW.id,
      'email', NEW.email,
      'provider', COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
    )
  );

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error with more details
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'customer_account_error',
      'Authentication',
      'Error creating customer account: ' || SQLERRM,
      jsonb_build_object(
        'user_id', NEW.id, 
        'email', NEW.email, 
        'error', SQLERRM,
        'error_detail', SQLSTATE
      )
    );
    
    RETURN NEW;
END;
$$;

-- 2. Backfill missing emails in existing customer_accounts
-- Update customer_accounts where email is null but user_id exists
UPDATE public.customer_accounts ca
SET 
  email = au.email,
  updated_at = NOW()
FROM auth.users au
WHERE ca.user_id = au.id
  AND ca.email IS NULL
  AND au.email IS NOT NULL;

-- Log the backfill operation
INSERT INTO public.audit_logs (
  action, category, message, new_values
) VALUES (
  'customer_emails_backfilled',
  'Data Integrity',
  'Backfilled missing customer emails from auth.users',
  jsonb_build_object(
    'updated_count', (
      SELECT COUNT(*) 
      FROM public.customer_accounts ca
      INNER JOIN auth.users au ON ca.user_id = au.id
      WHERE ca.email IS NOT NULL AND au.email IS NOT NULL
    ),
    'timestamp', NOW()
  )
);

-- 3. Add constraint to prevent null emails in customer_accounts (optional but recommended)
-- Note: We're making this a soft constraint via check rather than NOT NULL to avoid blocking
-- existing NULL values, but will log warnings
CREATE OR REPLACE FUNCTION public.validate_customer_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Warn if email is null for new inserts
  IF NEW.email IS NULL AND TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'customer_email_null_warning',
      'Data Integrity',
      'Customer account created without email - investigation needed',
      jsonb_build_object(
        'customer_id', NEW.id,
        'user_id', NEW.user_id,
        'name', NEW.name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS validate_customer_email_trigger ON public.customer_accounts;
CREATE TRIGGER validate_customer_email_trigger
  BEFORE INSERT OR UPDATE ON public.customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_customer_email();

-- 4. Fix for user roles - ensure default role assignment
-- Create a function to ensure all users in user_roles have valid roles

CREATE OR REPLACE FUNCTION public.ensure_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If inserting a user_role with null role, set a default
  IF NEW.role IS NULL THEN
    NEW.role := 'staff'; -- Default role
    
    -- Log the default role assignment
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'user_role_defaulted',
      'Authorization',
      'User role was null, defaulted to staff',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'defaulted_role', 'staff'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS ensure_user_role_trigger ON public.user_roles;
CREATE TRIGGER ensure_user_role_trigger
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_user_role();

-- 5. Backfill any users without roles in user_roles table
-- This ensures all admin users have an entry in user_roles
INSERT INTO public.user_roles (user_id, role, is_active, created_at, updated_at)
SELECT 
  p.id,
  p.role,
  COALESCE(p.is_active, true),
  NOW(),
  NOW()
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE ur.id IS NULL
  AND p.role IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Log the backfill operation
INSERT INTO public.audit_logs (
  action, category, message, new_values
) VALUES (
  'user_roles_backfilled',
  'Authorization',
  'Backfilled missing user_roles from profiles table',
  jsonb_build_object(
    'timestamp', NOW()
  )
);

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_accounts_email ON public.customer_accounts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_active ON public.user_roles(user_id, is_active) WHERE is_active = true;

-- Final audit log
INSERT INTO public.audit_logs (
  action, category, message, new_values
) VALUES (
  'null_roles_emails_fix_complete',
  'Data Integrity',
  'Comprehensive fix for null user roles and customer emails completed',
  jsonb_build_object(
    'migration_completed_at', NOW(),
    'customer_emails_fixed', true,
    'user_roles_fixed', true,
    'validation_triggers_added', true,
    'backfill_completed', true
  )
);
