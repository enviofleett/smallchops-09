-- Create function to handle new customer authentication (including Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_customer_auth()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
  customer_id UUID;
  existing_customer RECORD;
BEGIN
  -- Only handle customer registrations (not admin/staff)
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    user_email := NEW.email;
    user_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

    -- Check if this is a customer (not admin/staff)
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = NEW.id AND role IN ('admin', 'manager', 'staff')
    ) THEN
      -- Check if customer already exists in customers table
      SELECT * INTO existing_customer FROM public.customers WHERE email = user_email;
      
      IF NOT FOUND THEN
        -- Create new customer record
        INSERT INTO public.customers (name, email, created_at, updated_at)
        VALUES (user_name, user_email, NOW(), NOW())
        RETURNING id INTO customer_id;
        
        -- Log customer creation
        INSERT INTO public.audit_logs (
          action, category, message, new_values, user_id
        ) VALUES (
          'customer_created_oauth',
          'Customer Management', 
          'Customer created via OAuth: ' || user_email,
          jsonb_build_object(
            'customer_id', customer_id,
            'email', user_email,
            'name', user_name,
            'auth_provider', COALESCE(NEW.app_metadata->>'provider', 'email'),
            'oauth_signup', true
          ),
          NEW.id
        );
      ELSE
        customer_id := existing_customer.id;
        
        -- Update existing customer name if empty or different
        IF existing_customer.name IS NULL OR LENGTH(TRIM(existing_customer.name)) = 0 OR existing_customer.name != user_name THEN
          UPDATE public.customers 
          SET name = user_name, updated_at = NOW()
          WHERE id = customer_id;
        END IF;
      END IF;

      -- Create customer account for authenticated user
      INSERT INTO public.customer_accounts (user_id, name, created_at, updated_at)
      VALUES (NEW.id, user_name, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = NOW();

      -- Queue welcome email immediately for all new authentications
      INSERT INTO public.communication_events (
        event_type,
        recipient_email,
        status,
        email_type,
        template_id,
        template_key,
        variables,
        payload,
        created_at,
        updated_at
      ) VALUES (
        'customer_welcome',
        user_email,
        'queued',
        'transactional',
        'welcome_customer',
        'welcome_customer',
        jsonb_build_object(
          'customerName', user_name,
          'authProvider', COALESCE(NEW.app_metadata->>'provider', 'email'),
          'isOAuth', (NEW.app_metadata->>'provider' IS NOT NULL AND NEW.app_metadata->>'provider' != 'email')
        ),
        jsonb_build_object(
          'customer_id', customer_id,
          'user_id', NEW.id,
          'registration_type', 'oauth_authentication',
          'auth_provider', COALESCE(NEW.app_metadata->>'provider', 'email'),
          'trigger', 'automatic_oauth_welcome'
        ),
        NOW(),
        NOW()
      );

      -- Log welcome email queuing
      INSERT INTO public.audit_logs (
        action, category, message, new_values, user_id
      ) VALUES (
        'welcome_email_queued_oauth',
        'Email Processing',
        'Welcome email queued for OAuth customer: ' || user_email,
        jsonb_build_object(
          'customer_id', customer_id,
          'email', user_email,
          'auth_provider', COALESCE(NEW.app_metadata->>'provider', 'email'),
          'is_oauth', true
        ),
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'oauth_welcome_error',
      'Email Processing',
      'Error in OAuth welcome email trigger: ' || SQLERRM,
      jsonb_build_object(
        'error', SQLERRM,
        'user_id', NEW.id,
        'email', NEW.email,
        'provider', NEW.app_metadata->>'provider'
      )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new customer authentication
DROP TRIGGER IF EXISTS trigger_handle_new_customer_auth ON auth.users;
CREATE TRIGGER trigger_handle_new_customer_auth
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_customer_auth();

-- Create function for instant email processing after queueing
CREATE OR REPLACE FUNCTION public.trigger_instant_email_processing()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for queued welcome emails
  IF NEW.status = 'queued' AND NEW.event_type = 'customer_welcome' THEN
    -- Use pg_notify to trigger background processing
    PERFORM pg_notify('instant_email_processing', 
      jsonb_build_object(
        'event_id', NEW.id,
        'event_type', NEW.event_type,
        'recipient', NEW.recipient_email,
        'timestamp', NOW()
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for instant processing
DROP TRIGGER IF EXISTS trigger_instant_email_processing ON communication_events;
CREATE TRIGGER trigger_instant_email_processing
  AFTER INSERT ON communication_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_instant_email_processing();