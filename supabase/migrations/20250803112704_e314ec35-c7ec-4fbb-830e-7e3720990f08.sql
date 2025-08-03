-- Fix the admin profile creation trigger to only handle admin registrations
-- and create a separate trigger for customer accounts

-- First, update the existing trigger to be more specific about admin registrations
CREATE OR REPLACE FUNCTION public.handle_new_admin_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  user_name TEXT;
  user_role user_role;
BEGIN
  -- Only handle admin/staff registrations based on email patterns or explicit role
  IF NEW.email LIKE '%admin%' OR 
     NEW.email LIKE '%@company.%' OR 
     NEW.raw_user_meta_data->>'role' IS NOT NULL OR
     NEW.raw_user_meta_data->>'user_type' = 'admin' THEN
    
    user_name := COALESCE(
      NEW.raw_user_meta_data->>'name', 
      NEW.raw_user_meta_data->>'full_name', 
      split_part(NEW.email, '@', 1)
    );
    user_role := COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role, 
      'admin'::user_role
    );

    -- Insert into profiles table for admin users
    INSERT INTO public.profiles (id, name, email, role)
    VALUES (NEW.id, user_name, NEW.email, user_role)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = NOW();

    -- Log admin profile creation
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'admin_profile_created',
      'Authentication',
      'Created admin profile for: ' || NEW.email,
      jsonb_build_object('profile_id', NEW.id, 'role', user_role)
    );
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log admin profile creation errors
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'admin_profile_error',
      'Authentication',
      'Error creating admin profile: ' || SQLERRM,
      jsonb_build_object('user_id', NEW.id, 'email', NEW.email, 'error', SQLERRM)
    );
    RETURN NEW;
END;
$function$;

-- Create a new trigger for customer account creation
CREATE OR REPLACE FUNCTION public.handle_new_customer_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  user_name TEXT;
  user_phone TEXT;
BEGIN
  -- Handle customer registrations (not admin)
  IF NEW.raw_user_meta_data->>'user_type' = 'customer' OR 
     (NEW.email NOT LIKE '%admin%' AND 
      NEW.email NOT LIKE '%@company.%' AND 
      NEW.raw_user_meta_data->>'role' IS NULL) THEN
    
    user_name := COALESCE(
      NEW.raw_user_meta_data->>'name', 
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    );
    user_phone := NEW.raw_user_meta_data->>'phone';

    -- Insert into customer_accounts table
    INSERT INTO public.customer_accounts (user_id, name, phone)
    VALUES (NEW.id, user_name, user_phone)
    ON CONFLICT (user_id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      updated_at = NOW();

    -- Log customer account creation
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'customer_account_created',
      'Authentication',
      'Created customer account for: ' || NEW.email,
      jsonb_build_object('user_id', NEW.id, 'name', user_name)
    );
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log customer account creation errors but don't block auth
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'customer_account_error',
      'Authentication',
      'Error creating customer account: ' || SQLERRM,
      jsonb_build_object('user_id', NEW.id, 'email', NEW.email, 'error', SQLERRM)
    );
    RETURN NEW;
END;
$function$;

-- Update the existing trigger name and add new customer trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create separate triggers for admin and customer account creation
CREATE TRIGGER on_auth_admin_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin_profile();

CREATE TRIGGER on_auth_customer_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer_account();