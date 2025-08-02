-- Phase 1: Fix Critical Database Error (Corrected)
-- Drop the existing problematic trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved user profile handling function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_name TEXT;
  user_email TEXT;
  profile_exists BOOLEAN := FALSE;
BEGIN
  -- Safely extract user information
  user_email := COALESCE(NEW.email, '');
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'display_name',
    split_part(user_email, '@', 1)
  );

  -- Check if profile already exists (prevent duplicates)
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) INTO profile_exists;
  
  IF NOT profile_exists THEN
    -- Insert into profiles table with error handling
    BEGIN
      INSERT INTO public.profiles (id, name, email, role)
      VALUES (
        NEW.id, 
        user_name, 
        user_email,
        'admin'::user_role  -- Set default role
      );
      
      -- Log successful profile creation
      INSERT INTO public.audit_logs (
        action, category, message, new_values
      ) VALUES (
        'user_profile_created',
        'Authentication',
        'Created user profile for: ' || user_email,
        jsonb_build_object(
          'user_id', NEW.id, 
          'name', user_name,
          'email', user_email,
          'provider', COALESCE(NEW.raw_user_meta_data->>'provider', 'email')
        )
      );

    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the registration
      INSERT INTO public.audit_logs (
        action, category, message, new_values
      ) VALUES (
        'user_profile_error',
        'Authentication',
        'Error creating user profile: ' || SQLERRM,
        jsonb_build_object(
          'user_id', NEW.id, 
          'email', user_email, 
          'error', SQLERRM
        )
      );
    END;
  END IF;

  -- Create customer record for guest checkout compatibility
  IF user_email IS NOT NULL AND LENGTH(user_email) > 0 THEN
    BEGIN
      INSERT INTO public.customers (name, email)
      VALUES (user_name, user_email)
      ON CONFLICT (email) DO NOTHING;

      -- Queue welcome email
      INSERT INTO public.communication_events (
        event_type,
        recipient_email,
        template_key,
        template_variables,
        status,
        priority
      ) VALUES (
        'customer_welcome',
        user_email,
        'customer_welcome',
        jsonb_build_object(
          'customer_name', user_name,
          'customer_email', user_email
        ),
        'queued',
        'high'
      );

    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail
      INSERT INTO public.audit_logs (
        action, category, message, new_values
      ) VALUES (
        'customer_creation_error',
        'Authentication',
        'Error creating customer record: ' || SQLERRM,
        jsonb_build_object('user_id', NEW.id, 'error', SQLERRM)
      );
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();