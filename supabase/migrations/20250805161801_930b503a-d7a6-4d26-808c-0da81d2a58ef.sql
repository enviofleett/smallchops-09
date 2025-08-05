-- Phase 2: Fix Google OAuth and Email Processing

-- Enhanced handle_new_user trigger with better error handling
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

  -- Create customer account for all new users
  INSERT INTO public.customer_accounts (
    user_id, 
    name, 
    phone,
    email_verified,
    profile_completion_percentage
  ) VALUES (
    NEW.id, 
    user_name, 
    user_phone,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    CASE 
      WHEN user_phone IS NOT NULL THEN 80
      ELSE 60
    END
  ) RETURNING id INTO account_id;

  -- Log account creation
  INSERT INTO public.audit_logs (
    action, category, message, new_values
  ) VALUES (
    'customer_account_created',
    'Authentication',
    'Created customer account for: ' || NEW.email,
    jsonb_build_object(
      'account_id', account_id, 
      'user_id', NEW.id,
      'provider', COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
    )
  );

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
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
$$;

-- Create function to process stuck emails
CREATE OR REPLACE FUNCTION public.process_stuck_emails()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
  processed_count INTEGER := 0;
BEGIN
  -- Reset stuck emails to trigger reprocessing
  UPDATE communication_events 
  SET status = 'pending'::communication_event_status,
      retry_count = 0,
      updated_at = NOW(),
      error_message = NULL,
      last_error = NULL
  WHERE status = 'queued'::communication_event_status
    AND created_at < NOW() - INTERVAL '2 minutes';
    
  GET DIAGNOSTICS processed_count = ROW_COUNT;
  
  -- Log the processing
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'email_stuck_processing',
    'Email System',
    'Processed ' || processed_count || ' stuck emails',
    jsonb_build_object('processed_count', processed_count)
  );
  
  RETURN processed_count;
END;
$$;

-- Trigger stuck email processing
SELECT process_stuck_emails();