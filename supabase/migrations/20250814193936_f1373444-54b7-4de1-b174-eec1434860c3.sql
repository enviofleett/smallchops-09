-- CRITICAL SECURITY FIXES FOR REGISTRATION FLOW (Fixed)

-- 1. Add IP-based rate limiting table
CREATE TABLE IF NOT EXISTS customer_registration_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET,
  email_lower TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(email_lower)
);

-- Index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_registration_rate_limits_ip_time 
ON customer_registration_rate_limits(ip_address, last_attempt_at) WHERE ip_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registration_rate_limits_email_time 
ON customer_registration_rate_limits(email_lower, last_attempt_at);

-- RLS for rate limits table
ALTER TABLE customer_registration_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service roles can manage rate limits" 
ON customer_registration_rate_limits FOR ALL 
USING (auth.role() = 'service_role');

-- 2. Enhanced OTP security with attempt tracking
ALTER TABLE customer_otp_codes 
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS correlation_id UUID DEFAULT gen_random_uuid();

-- 3. Automatic OTP cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM customer_otp_codes 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log cleanup activity
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'otp_cleanup',
    'Security',
    'Automated OTP cleanup completed',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'cleanup_time', NOW()
    )
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enhanced rate limiting function with IP tracking
CREATE OR REPLACE FUNCTION check_registration_rate_limit_secure(
  p_email TEXT,
  p_ip_address INET DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_email_count INTEGER;
  v_ip_count INTEGER;
  v_last_attempt TIMESTAMP WITH TIME ZONE;
  v_blocked_until TIMESTAMP WITH TIME ZONE;
  v_email_lower TEXT := LOWER(p_email);
BEGIN
  -- Check email-based rate limit (5 per hour)
  SELECT COUNT(*), MAX(last_attempt_at), MAX(blocked_until)
  INTO v_email_count, v_last_attempt, v_blocked_until
  FROM customer_registration_rate_limits
  WHERE email_lower = v_email_lower 
    AND last_attempt_at > NOW() - INTERVAL '1 hour';
  
  -- Check if email is currently blocked
  IF v_blocked_until IS NOT NULL AND v_blocked_until > NOW() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'email_blocked',
      'retry_after_seconds', EXTRACT(EPOCH FROM (v_blocked_until - NOW()))::INTEGER,
      'remaining', 0
    );
  END IF;
  
  -- Check cooldown period (1 minute between attempts)
  IF v_last_attempt IS NOT NULL AND v_last_attempt > NOW() - INTERVAL '1 minute' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'cooldown',
      'retry_after_seconds', 60 - EXTRACT(EPOCH FROM (NOW() - v_last_attempt))::INTEGER,
      'remaining', 0
    );
  END IF;
  
  -- Check hourly limit for email
  IF v_email_count >= 5 THEN
    -- Block email for 1 hour
    INSERT INTO customer_registration_rate_limits (
      ip_address, email_lower, attempts, blocked_until
    ) VALUES (
      p_ip_address, v_email_lower, v_email_count + 1, NOW() + INTERVAL '1 hour'
    )
    ON CONFLICT (email_lower) 
    DO UPDATE SET 
      attempts = customer_registration_rate_limits.attempts + 1,
      last_attempt_at = NOW(),
      blocked_until = NOW() + INTERVAL '1 hour';
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'email_rate_limited',
      'retry_after_seconds', 3600,
      'remaining', 0
    );
  END IF;
  
  -- Check IP-based rate limit if provided (20 per hour)
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_ip_count
    FROM customer_registration_rate_limits
    WHERE ip_address = p_ip_address 
      AND last_attempt_at > NOW() - INTERVAL '1 hour';
    
    IF v_ip_count >= 20 THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'ip_rate_limited',
        'retry_after_seconds', 3600,
        'remaining', 0
      );
    END IF;
  END IF;
  
  -- Update rate limit tracking
  INSERT INTO customer_registration_rate_limits (
    ip_address, email_lower, attempts
  ) VALUES (
    p_ip_address, v_email_lower, 1
  )
  ON CONFLICT (email_lower) 
  DO UPDATE SET 
    attempts = customer_registration_rate_limits.attempts + 1,
    last_attempt_at = NOW(),
    ip_address = COALESCE(EXCLUDED.ip_address, customer_registration_rate_limits.ip_address);
  
  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', 5 - v_email_count - 1,
    'ip_remaining', CASE 
      WHEN p_ip_address IS NOT NULL THEN 20 - v_ip_count - 1 
      ELSE NULL 
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Enhanced OTP verification with security
CREATE OR REPLACE FUNCTION verify_customer_otp_secure(
  p_email TEXT,
  p_otp_code TEXT,
  p_otp_type TEXT,
  p_ip_address INET DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_otp_record RECORD;
  v_customer_id UUID;
  v_attempt_count INTEGER;
BEGIN
  -- Find the OTP record
  SELECT * INTO v_otp_record
  FROM customer_otp_codes
  WHERE email = LOWER(p_email)
    AND otp_type = p_otp_type
    AND expires_at > NOW()
    AND used_at IS NULL
    AND (locked_until IS NULL OR locked_until <= NOW())
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- Log failed verification attempt
    PERFORM log_security_event(
      'otp_verification_failed',
      'medium',
      'OTP verification failed - code not found or expired',
      NULL,
      p_ip_address,
      NULL,
      jsonb_build_object(
        'email', LOWER(p_email), 
        'otp_type', p_otp_type,
        'correlation_id', p_correlation_id
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired OTP code'
    );
  END IF;
  
  -- Check if OTP code matches
  IF v_otp_record.otp_code != p_otp_code THEN
    -- Increment failed attempts
    UPDATE customer_otp_codes 
    SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
        locked_until = CASE 
          WHEN COALESCE(failed_attempts, 0) + 1 >= 3 THEN NOW() + INTERVAL '15 minutes'
          ELSE locked_until
        END
    WHERE id = v_otp_record.id;
    
    -- Log failed attempt
    PERFORM log_security_event(
      'otp_verification_failed',
      'high',
      'OTP verification failed - incorrect code',
      NULL,
      p_ip_address,
      NULL,
      jsonb_build_object(
        'email', LOWER(p_email), 
        'otp_type', p_otp_type,
        'failed_attempts', COALESCE(v_otp_record.failed_attempts, 0) + 1,
        'correlation_id', p_correlation_id
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid OTP code',
      'attempts_remaining', 3 - (COALESCE(v_otp_record.failed_attempts, 0) + 1)
    );
  END IF;
  
  -- Mark OTP as used
  UPDATE customer_otp_codes 
  SET used_at = NOW(),
      ip_address = p_ip_address,
      correlation_id = COALESCE(p_correlation_id, correlation_id)
  WHERE id = v_otp_record.id;
  
  -- Handle customer account creation/update
  SELECT id INTO v_customer_id
  FROM customer_accounts
  WHERE email = LOWER(p_email);
  
  IF NOT FOUND THEN
    INSERT INTO customer_accounts (email, name, phone, email_verified)
    VALUES (
      LOWER(p_email),
      COALESCE(v_otp_record.verification_metadata->>'name', SPLIT_PART(p_email, '@', 1)),
      v_otp_record.verification_metadata->>'phone',
      true
    )
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE customer_accounts 
    SET email_verified = true,
        name = COALESCE(v_otp_record.verification_metadata->>'name', name),
        phone = COALESCE(v_otp_record.verification_metadata->>'phone', phone)
    WHERE id = v_customer_id;
  END IF;
  
  -- Log successful verification
  PERFORM log_security_event(
    'otp_verification_success',
    'low',
    'OTP verification successful',
    NULL,
    p_ip_address,
    NULL,
    jsonb_build_object(
      'email', LOWER(p_email), 
      'customer_id', v_customer_id,
      'otp_type', p_otp_type,
      'correlation_id', COALESCE(p_correlation_id, v_otp_record.correlation_id)
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'customer_id', v_customer_id,
    'email_verified', true,
    'correlation_id', COALESCE(p_correlation_id, v_otp_record.correlation_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;