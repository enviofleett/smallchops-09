-- Fix the handle_new_customer_auth function to use correct metadata field names
CREATE OR REPLACE FUNCTION public.handle_new_customer_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  customer_name TEXT;
  provider_type TEXT;
BEGIN
  BEGIN
    -- Extract provider from raw_app_meta_data (not app_metadata)
    provider_type := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
    
    -- Extract customer name from user metadata or email
    customer_name := COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    );

    -- Create customer record
    INSERT INTO public.customers (name, email, user_id)
    VALUES (customer_name, NEW.email, NEW.id)
    ON CONFLICT (email) DO NOTHING;

    -- Create customer account record
    INSERT INTO public.customer_accounts (user_id, name, phone)
    VALUES (
      NEW.id,
      customer_name,
      NEW.raw_user_meta_data->>'phone'
    )
    ON CONFLICT (user_id) DO NOTHING;

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

    RETURN NEW;

  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the registration
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
      
      -- Still return NEW to allow auth user creation to succeed
      RETURN NEW;
  END;
END;
$function$;