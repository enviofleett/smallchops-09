-- Fix customer registration and OTP verification system for production

-- Create or replace function to handle post-verification welcome email
CREATE OR REPLACE FUNCTION public.trigger_customer_welcome_after_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only trigger for new registrations that are being verified
  IF NEW.email_verified = true AND (OLD.email_verified IS NULL OR OLD.email_verified = false) THEN
    -- Queue welcome email via communication_events
    INSERT INTO communication_events (
      event_type,
      recipient_email,
      template_key,
      variables,
      template_variables,
      status,
      priority,
      retry_count,
      created_at
    ) VALUES (
      'customer_welcome',
      NEW.email,
      'welcome_customer',
      jsonb_build_object(
        'customerName', NEW.name,
        'customerEmail', NEW.email,
        'registrationDate', NOW()::text,
        'authProvider', 'email_verification',
        'isWelcomeEmail', true
      ),
      jsonb_build_object(
        'customerName', NEW.name,
        'customerEmail', NEW.email
      ),
      'queued',
      'high',
      0,
      NOW()
    );
    
    -- Log the welcome email trigger
    INSERT INTO audit_logs (
      action,
      category,
      message,
      new_values
    ) VALUES (
      'registration_welcome_email_queued',
      'Email Processing',
      'Registration welcome email queued for: ' || NEW.email,
      jsonb_build_object(
        'customer_account_id', NEW.id,
        'customer_email', NEW.email,
        'customer_name', NEW.name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for welcome email after email verification
DROP TRIGGER IF EXISTS trigger_welcome_after_verification ON customer_accounts;
CREATE TRIGGER trigger_welcome_after_verification
  AFTER UPDATE ON customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_customer_welcome_after_verification();

-- Improve the verify_customer_otp function to better handle registration completion
CREATE OR REPLACE FUNCTION public.verify_customer_otp(
  p_email text, 
  p_otp_code text, 
  p_otp_type text, 
  p_ip_address inet DEFAULT NULL::inet
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_otp_record RECORD;
  v_customer_id UUID;
  v_registration_data JSONB;
  v_result JSONB;
BEGIN
  -- Find valid OTP
  SELECT * INTO v_otp_record
  FROM public.customer_otp_codes
  WHERE email = p_email
    AND otp_code = p_otp_code
    AND otp_type = p_otp_type
    AND expires_at > NOW()
    AND used_at IS NULL
    AND attempts < max_attempts
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- Increment attempt count for failed attempts
    UPDATE public.customer_otp_codes
    SET attempts = attempts + 1
    WHERE email = p_email
      AND otp_code = p_otp_code
      AND otp_type = p_otp_type
      AND expires_at > NOW()
      AND used_at IS NULL;
    
    -- Log failed attempt
    INSERT INTO public.customer_auth_audit (
      email, action, success, ip_address, failure_reason, metadata
    ) VALUES (
      p_email, 'otp_verification', false, p_ip_address, 
      'Invalid or expired OTP', 
      jsonb_build_object('otp_type', p_otp_type)
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired OTP code'
    );
  END IF;

  -- Mark OTP as used
  UPDATE public.customer_otp_codes
  SET used_at = NOW(),
      attempts = attempts + 1
  WHERE id = v_otp_record.id;

  -- Handle different OTP types
  IF p_otp_type = 'registration' THEN
    -- Get registration data from OTP metadata
    v_registration_data := v_otp_record.verification_metadata;
    
    -- Update customer account to verified status
    UPDATE public.customer_accounts
    SET email_verified = true,
        phone = COALESCE(v_registration_data->>'phone', phone),
        updated_at = NOW()
    WHERE email = p_email
    RETURNING id INTO v_customer_id;
    
    -- If customer account doesn't exist, create it
    IF v_customer_id IS NULL THEN
      INSERT INTO public.customer_accounts (
        name, email, phone, email_verified
      ) VALUES (
        v_registration_data->>'name',
        p_email,
        v_registration_data->>'phone',
        true
      )
      RETURNING id INTO v_customer_id;
    END IF;
    
  ELSE
    -- For other types, find existing customer
    SELECT id INTO v_customer_id
    FROM public.customer_accounts
    WHERE email = p_email;
  END IF;

  -- Log successful verification
  INSERT INTO public.customer_auth_audit (
    customer_id, email, action, success, ip_address, metadata
  ) VALUES (
    v_customer_id, p_email, 'otp_verification', true, p_ip_address,
    jsonb_build_object(
      'otp_type', p_otp_type, 
      'otp_id', v_otp_record.id,
      'registration_completed', p_otp_type = 'registration'
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'customer_id', v_customer_id,
    'email_verified', true,
    'registration_completed', p_otp_type = 'registration'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    INSERT INTO public.customer_auth_audit (
      email, action, success, ip_address, failure_reason, metadata
    ) VALUES (
      p_email, 'otp_verification', false, p_ip_address,
      'Database error: ' || SQLERRM,
      jsonb_build_object('otp_type', p_otp_type)
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Verification failed due to system error'
    );
END;
$function$;

-- Create function to clean up expired OTP codes (for maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_codes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.customer_otp_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour'; -- Keep expired codes for 1 hour for audit
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Log cleanup activity
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'otp_cleanup',
    'System Maintenance',
    'Cleaned up ' || v_deleted_count || ' expired OTP codes',
    jsonb_build_object('deleted_count', v_deleted_count)
  );
  
  RETURN v_deleted_count;
END;
$function$;