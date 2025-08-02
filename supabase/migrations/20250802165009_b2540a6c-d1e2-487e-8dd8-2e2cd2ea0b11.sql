-- Phase 1: Fix Critical Database Error
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
        CASE 
          WHEN user_email LIKE '%admin%' OR user_email LIKE '%@company.%' 
          THEN 'admin'::user_role
          ELSE 'admin'::user_role  -- Default role
        END
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

-- Phase 3: Enhanced Welcome Email System
-- Create email processing queue table
CREATE TABLE IF NOT EXISTS public.email_processing_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  scheduled_for timestamp with time zone NOT NULL DEFAULT NOW(),
  processed_at timestamp with time zone NULL,
  max_attempts integer NOT NULL DEFAULT 3,
  current_attempts integer NOT NULL DEFAULT 0,
  last_error text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Enhanced email configuration
CREATE TABLE IF NOT EXISTS public.enhanced_email_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instant_processing_enabled boolean NOT NULL DEFAULT true,
  max_retries integer NOT NULL DEFAULT 3,
  retry_delay_minutes integer NOT NULL DEFAULT 5,
  batch_size integer NOT NULL DEFAULT 50,
  health_check_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Insert default config
INSERT INTO public.enhanced_email_config (instant_processing_enabled, max_retries)
VALUES (true, 3)
ON CONFLICT DO NOTHING;

-- Phase 4: Security Hardening - Enhanced Rate Limiting
CREATE TABLE IF NOT EXISTS public.enhanced_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier text NOT NULL, -- email, ip, etc
  identifier_type text NOT NULL DEFAULT 'email',
  action_type text NOT NULL, -- registration, login, etc
  window_start timestamp with time zone NOT NULL DEFAULT NOW(),
  window_end timestamp with time zone NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  attempt_count integer NOT NULL DEFAULT 1,
  max_attempts integer NOT NULL DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enhanced_rate_limits_lookup 
ON public.enhanced_rate_limits(identifier, identifier_type, action_type, window_end);

-- Function to check registration rate limits
CREATE OR REPLACE FUNCTION public.check_registration_rate_limit(
  p_identifier text,
  p_identifier_type text DEFAULT 'email'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count integer := 0;
  v_max_attempts integer := 5;
  v_current_window timestamp with time zone := date_trunc('hour', NOW());
  v_window_end timestamp with time zone := v_current_window + INTERVAL '1 hour';
BEGIN
  -- Clean up expired windows
  DELETE FROM public.enhanced_rate_limits 
  WHERE window_end < NOW();
  
  -- Check current attempts in this window
  SELECT COALESCE(SUM(attempt_count), 0) INTO v_current_count
  FROM public.enhanced_rate_limits
  WHERE identifier = p_identifier
    AND identifier_type = p_identifier_type
    AND action_type = 'registration'
    AND window_end > NOW();
  
  -- If under limit, record this attempt
  IF v_current_count < v_max_attempts THEN
    INSERT INTO public.enhanced_rate_limits (
      identifier, identifier_type, action_type, 
      window_start, window_end, attempt_count, max_attempts
    ) VALUES (
      p_identifier, p_identifier_type, 'registration',
      v_current_window, v_window_end, 1, v_max_attempts
    )
    ON CONFLICT DO NOTHING;
    
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;