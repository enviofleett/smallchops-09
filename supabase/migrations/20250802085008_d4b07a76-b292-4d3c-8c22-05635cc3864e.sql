-- Fix the incomplete handle_new_customer_registration function
DROP FUNCTION IF EXISTS public.handle_new_customer_registration() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_customer_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_name TEXT;
  user_phone TEXT;
  user_email TEXT;
  customer_uuid UUID;
  normalized_phone TEXT;
  validation_errors TEXT[] := '{}';
BEGIN
  -- Enhanced logging for debugging
  INSERT INTO public.audit_logs (
    action, category, message, new_values
  ) VALUES (
    'customer_registration_start',
    'Authentication',
    'Starting customer registration for: ' || NEW.email,
    jsonb_build_object(
      'user_id', NEW.id, 
      'email', NEW.email, 
      'metadata', NEW.raw_user_meta_data,
      'confirmed_at', NEW.confirmed_at
    )
  );

  -- Extract and validate user data with comprehensive fallbacks
  user_email := COALESCE(NEW.email, '');
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name', 
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'firstName' || ' ' || NEW.raw_user_meta_data->>'lastName',
    split_part(user_email, '@', 1)
  );
  
  -- Enhanced phone extraction with multiple field variations
  user_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone', 
    NEW.raw_user_meta_data->>'phoneNumber',
    NEW.raw_user_meta_data->>'phone_number',
    NEW.raw_user_meta_data->>'mobile'
  );
  
  -- Normalize phone number (remove non-digits, keep only digits)
  IF user_phone IS NOT NULL THEN
    normalized_phone := regexp_replace(user_phone, '[^\d]', '', 'g');
    -- Only keep phone if it has at least 10 digits
    IF length(normalized_phone) < 10 THEN
      normalized_phone := NULL;
    END IF;
  END IF;

  -- Validate required fields
  IF user_email IS NULL OR length(trim(user_email)) = 0 THEN
    validation_errors := array_append(validation_errors, 'Email is required');
  END IF;
  
  IF user_name IS NULL OR length(trim(user_name)) = 0 THEN
    validation_errors := array_append(validation_errors, 'Name is required');
  END IF;

  -- If there are validation errors, log them and raise exception
  IF array_length(validation_errors, 1) > 0 THEN
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'customer_registration_validation_error',
      'Authentication',
      'Validation failed for: ' || user_email,
      jsonb_build_object(
        'user_id', NEW.id,
        'errors', validation_errors,
        'extracted_data', jsonb_build_object(
          'name', user_name,
          'phone', user_phone,
          'normalized_phone', normalized_phone
        )
      )
    );
    
    RAISE EXCEPTION 'Customer registration validation failed: %', array_to_string(validation_errors, ', ');
  END IF;

  -- Only proceed if this is a customer registration (skip admin registrations)
  IF user_email NOT LIKE '%admin%' AND user_email NOT LIKE '%@company.%' THEN
    
    BEGIN
      -- Insert into customers table first (this is the main customer record)
      INSERT INTO public.customers (name, email, phone)
      VALUES (user_name, user_email, normalized_phone)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        phone = COALESCE(EXCLUDED.phone, customers.phone),
        updated_at = NOW()
      RETURNING id INTO customer_uuid;

      -- Insert/update customer_accounts table (links to auth.users)
      INSERT INTO public.customer_accounts (user_id, name, phone)
      VALUES (NEW.id, user_name, normalized_phone)
      ON CONFLICT (user_id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = COALESCE(EXCLUDED.phone, customer_accounts.phone),
        updated_at = NOW();

      -- Queue welcome email with CORRECT event type
      INSERT INTO public.communication_events (
        event_type,
        recipient_email,
        template_key,
        template_id,
        variables,
        email_type,
        status,
        created_at
      ) VALUES (
        'customer_welcome', -- FIXED: Use correct event type
        user_email,
        'welcome_customer',
        'welcome_customer',
        jsonb_build_object(
          'customerName', COALESCE(user_name, 'Valued Customer'),
          'companyName', 'Starters',
          'siteUrl', 'https://oknnklksdiqaifhxaccs.supabase.co'
        ),
        'transactional',
        'queued',
        NOW()
      );

      -- Log successful registration
      INSERT INTO public.audit_logs (
        action, category, message, new_values
      ) VALUES (
        'customer_registration_success',
        'Authentication',
        'Successfully registered customer: ' || user_email,
        jsonb_build_object(
          'customer_id', customer_uuid,
          'customer_account_id', NEW.id, 
          'phone_provided', normalized_phone IS NOT NULL,
          'welcome_email_queued', true,
          'final_data', jsonb_build_object(
            'name', user_name,
            'phone', normalized_phone,
            'email', user_email
          )
        )
      );

    EXCEPTION
      WHEN OTHERS THEN
        -- Enhanced error logging with full context
        INSERT INTO public.audit_logs (
          action, category, message, new_values
        ) VALUES (
          'customer_registration_error',
          'Authentication',
          'CRITICAL ERROR during customer registration: ' || SQLERRM,
          jsonb_build_object(
            'user_id', NEW.id,
            'email', NEW.email,
            'error_code', SQLSTATE,
            'error_message', SQLERRM,
            'error_detail', 'Full registration process failed',
            'extracted_data', jsonb_build_object(
              'name', user_name,
              'phone', normalized_phone,
              'email', user_email
            )
          )
        );
        
        -- Re-raise the error to fail the registration
        RAISE;
    END;
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Final catch-all error logging
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'customer_registration_fatal_error',
      'Authentication',
      'FATAL ERROR in customer registration trigger: ' || SQLERRM,
      jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'error_code', SQLSTATE,
        'error_message', SQLERRM,
        'trigger_execution_failed', true
      )
    );
    
    -- Don't fail auth registration for customer profile errors
    RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer_registration();

-- Fix the ambiguous delivery_status column issue by adding table prefix
CREATE OR REPLACE FUNCTION public.get_hourly_email_stats(start_time timestamp with time zone, end_time timestamp with time zone)
RETURNS TABLE(hour_bucket timestamp with time zone, total_sent integer, successful_delivered integer, failed_attempts integer, bounce_rate numeric, delivery_rate numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date_trunc('hour', ce.sent_at) as hour_bucket,
    COUNT(*)::integer as total_sent,
    COUNT(*) FILTER (WHERE edl.delivery_status = 'delivered')::integer as successful_delivered,
    COUNT(*) FILTER (WHERE ce.status = 'failed' OR edl.delivery_status IN ('bounced', 'complained'))::integer as failed_attempts,
    ROUND(
      (COUNT(*) FILTER (WHERE edl.delivery_status IN ('bounced', 'complained'))::numeric / NULLIF(COUNT(*), 0)) * 100, 
      2
    ) as bounce_rate,
    ROUND(
      (COUNT(*) FILTER (WHERE edl.delivery_status = 'delivered')::numeric / NULLIF(COUNT(*), 0)) * 100, 
      2
    ) as delivery_rate
  FROM communication_events ce
  LEFT JOIN smtp_delivery_logs edl ON ce.external_id = edl.email_id
  WHERE ce.sent_at BETWEEN start_time AND end_time
  AND ce.status != 'queued'
  GROUP BY date_trunc('hour', ce.sent_at)
  ORDER BY hour_bucket;
END;
$$;