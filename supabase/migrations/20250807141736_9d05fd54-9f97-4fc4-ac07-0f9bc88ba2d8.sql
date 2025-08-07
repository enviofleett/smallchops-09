-- Create missing database functions for customer registration system

-- Function to check OTP rate limits
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_recent_count INTEGER;
  v_last_otp_time TIMESTAMP WITH TIME ZONE;
  v_cooldown_minutes INTEGER := 1; -- 1 minute between OTP requests
  v_hourly_limit INTEGER := 5; -- Max 5 OTPs per hour
BEGIN
  -- Count recent OTP requests in the last hour
  SELECT COUNT(*), MAX(created_at)
  INTO v_recent_count, v_last_otp_time
  FROM customer_otp_codes 
  WHERE email = LOWER(p_email) 
    AND created_at > NOW() - INTERVAL '1 hour';
  
  -- Check if we're within cooldown period
  IF v_last_otp_time IS NOT NULL AND v_last_otp_time > NOW() - INTERVAL '1 minute' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'cooldown',
      'retry_after_seconds', 60,
      'remaining', 0
    );
  END IF;
  
  -- Check hourly limit
  IF v_recent_count >= v_hourly_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'retry_after_seconds', 3600,
      'remaining', 0
    );
  END IF;
  
  -- Allow the request
  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', v_hourly_limit - v_recent_count
  );
END;
$$;

-- Function to verify customer OTP
CREATE OR REPLACE FUNCTION public.verify_customer_otp(
  p_email text,
  p_otp_code text,
  p_otp_type text,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_otp_record RECORD;
  v_customer_id UUID;
BEGIN
  -- Find the OTP record
  SELECT * INTO v_otp_record
  FROM customer_otp_codes
  WHERE email = LOWER(p_email)
    AND otp_code = p_otp_code
    AND otp_type = p_otp_type
    AND expires_at > NOW()
    AND used_at IS NULL
    AND attempts < max_attempts
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Check if OTP was found
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired OTP code'
    );
  END IF;
  
  -- Mark OTP as used
  UPDATE customer_otp_codes 
  SET used_at = NOW(),
      attempts = attempts + 1
  WHERE id = v_otp_record.id;
  
  -- Get or create customer account
  SELECT id INTO v_customer_id
  FROM customer_accounts
  WHERE email = LOWER(p_email);
  
  IF NOT FOUND THEN
    -- Create customer account if it doesn't exist
    INSERT INTO customer_accounts (email, name, phone, email_verified)
    VALUES (
      LOWER(p_email),
      COALESCE(v_otp_record.verification_metadata->>'name', SPLIT_PART(p_email, '@', 1)),
      v_otp_record.verification_metadata->>'phone',
      true
    )
    RETURNING id INTO v_customer_id;
  ELSE
    -- Update existing customer account
    UPDATE customer_accounts 
    SET email_verified = true,
        name = COALESCE(v_otp_record.verification_metadata->>'name', name),
        phone = COALESCE(v_otp_record.verification_metadata->>'phone', phone)
    WHERE id = v_customer_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'customer_id', v_customer_id,
    'email_verified', true
  );
END;
$$;