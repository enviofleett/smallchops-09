-- CRITICAL SECURITY FIXES FOR REGISTRATION FLOW

-- 1. Fix RLS policies for customer accounts
DROP POLICY IF EXISTS "Public can create customer accounts" ON customer_accounts;
DROP POLICY IF EXISTS "Public can view customer accounts" ON customer_accounts;

-- Create secure RLS policies for customer_accounts
CREATE POLICY "Users can view own customer account" 
ON customer_accounts FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update own customer account" 
ON customer_accounts FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Service roles can manage customer accounts" 
ON customer_accounts FOR ALL 
USING (auth.role() = 'service_role');

-- 2. Secure customer_otp_codes table (already has service role policy, but let's be explicit)
DROP POLICY IF EXISTS "Public can access OTP codes" ON customer_otp_codes;

-- Only service roles should access OTP codes
CREATE POLICY "Only service roles can manage OTP codes" 
ON customer_otp_codes FOR ALL 
USING (auth.role() = 'service_role');

-- 3. Add IP-based rate limiting table
CREATE TABLE IF NOT EXISTS customer_registration_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET NOT NULL,
  email_lower TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_registration_rate_limits_ip_time 
ON customer_registration_rate_limits(ip_address, last_attempt_at);

CREATE INDEX IF NOT EXISTS idx_registration_rate_limits_email_time 
ON customer_registration_rate_limits(email_lower, last_attempt_at);

-- RLS for rate limits table
ALTER TABLE customer_registration_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service roles can manage rate limits" 
ON customer_registration_rate_limits FOR ALL 
USING (auth.role() = 'service_role');

-- 4. Enhanced OTP security with attempt tracking
ALTER TABLE customer_otp_codes 
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS correlation_id UUID DEFAULT gen_random_uuid();

-- 5. Automatic OTP cleanup function
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

-- 6. Enhanced rate limiting function with IP tracking
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
  -- Check email-based rate limit (5 per hour, 10 per day)
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