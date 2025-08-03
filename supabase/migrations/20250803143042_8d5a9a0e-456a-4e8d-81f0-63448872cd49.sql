-- Fix the database trigger by properly dropping existing dependencies
-- Drop trigger with CASCADE to handle dependencies

DROP TRIGGER IF EXISTS trigger_handle_new_customer_auth ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_customer_auth() CASCADE;

-- Create improved function to handle customer account creation
CREATE OR REPLACE FUNCTION public.handle_new_customer_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  customer_name TEXT;
  provider_type TEXT;
BEGIN
  BEGIN
    -- Only process INSERT events for new users with valid email
    IF TG_OP = 'INSERT' AND NEW.email IS NOT NULL AND NEW.id IS NOT NULL THEN

      -- Check if customer account already exists to prevent duplicates
      PERFORM 1 FROM public.customer_accounts WHERE user_id = NEW.id;
      IF FOUND THEN
        RETURN NEW; -- Account already exists, do nothing
      END IF;

      -- Extract provider from raw_app_meta_data
      provider_type := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

      -- Extract customer name from user metadata or email
      customer_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1)
      );

      -- Create customer account record
      INSERT INTO public.customer_accounts (user_id, name, phone)
      VALUES (
        NEW.id,
        customer_name,
        NEW.raw_user_meta_data->>'phone'
      );

      -- Queue welcome email
      INSERT INTO public.communication_events (
        event_type,
        recipient_email,
        status,
        template_variables,
        priority
      ) VALUES (
        'customer_welcome',
        NEW.email,
        'queued'::communication_event_status,
        jsonb_build_object(
          'customer_name', customer_name,
          'provider', provider_type
        ),
        'high'
      );

      -- Log successful registration
      INSERT INTO public.audit_logs (
        action,
        category,
        message,
        new_values,
        user_id
      ) VALUES (
        'customer_registered',
        'Authentication',
        'Customer registered successfully via ' || provider_type,
        jsonb_build_object(
          'customer_name', customer_name,
          'email', NEW.email,
          'provider', provider_type
        ),
        NEW.id
      );
    END IF;

    RETURN NEW;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail the registration
      INSERT INTO public.audit_logs (
        action,
        category,
        message,
        new_values
      ) VALUES (
        'customer_registration_error',
        'Authentication',
        'Error during customer registration: ' || SQLERRM,
        jsonb_build_object(
          'error', SQLERRM,
          'email', NEW.email,
          'user_id', NEW.id
        )
      );
      
      RETURN NEW;
  END;
END;
$$;

-- Create the trigger on auth.users table
CREATE TRIGGER trigger_handle_new_customer_auth
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_customer_auth();