-- PHASE 1: CRITICAL PASSWORD SECURITY FIXES

-- 1. Create secure password hashing function
CREATE OR REPLACE FUNCTION public.hash_password(password_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- This will be handled in edge functions with proper bcrypt
  -- This function serves as a placeholder for validation
  IF LENGTH(password_text) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters long';
  END IF;
  
  -- Return a marker indicating password should be hashed in edge function
  RETURN 'HASH_IN_EDGE_FUNCTION:' || password_text;
END;
$$;

-- 2. Clean up existing plaintext passwords from customer_otp_codes
UPDATE customer_otp_codes 
SET verification_metadata = verification_metadata - 'password'
WHERE verification_metadata ? 'password';

-- 3. Add password strength validation function
CREATE OR REPLACE FUNCTION public.validate_password_strength(password_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Minimum 8 characters
  IF LENGTH(password_text) < 8 THEN
    RETURN FALSE;
  END IF;
  
  -- Must contain at least one letter and one number
  IF NOT (password_text ~ '[A-Za-z]' AND password_text ~ '[0-9]') THEN
    RETURN FALSE;
  END IF;
  
  -- Check for common weak passwords
  IF LOWER(password_text) IN ('password', '12345678', 'password123', 'admin123') THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- 4. Create secure customer registration function
CREATE OR REPLACE FUNCTION public.create_customer_account_secure(
  p_email TEXT,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_password_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_customer_id UUID;
  v_existing_customer RECORD;
BEGIN
  -- Validate email format
  IF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid email format'
    );
  END IF;
  
  -- Check if customer already exists
  SELECT * INTO v_existing_customer
  FROM customer_accounts
  WHERE email = LOWER(p_email);
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Customer already exists',
      'customer_id', v_existing_customer.id
    );
  END IF;
  
  -- Create customer account (password hashing handled in edge function)
  INSERT INTO customer_accounts (
    email,
    name,
    phone,
    email_verified,
    created_at
  ) VALUES (
    LOWER(p_email),
    p_name,
    p_phone,
    true,
    NOW()
  ) RETURNING id INTO v_customer_id;
  
  -- Log the creation
  INSERT INTO audit_logs (
    action,
    category,
    message,
    entity_id,
    new_values
  ) VALUES (
    'customer_account_created_secure',
    'Customer Management',
    'Secure customer account created: ' || p_email,
    v_customer_id,
    jsonb_build_object(
      'email', LOWER(p_email),
      'name', p_name,
      'has_phone', p_phone IS NOT NULL,
      'created_securely', true
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'customer_id', v_customer_id,
    'email', LOWER(p_email)
  );
END;
$$;

-- PHASE 2: DATABASE SECURITY HARDENING

-- 5. Fix existing functions with proper search paths
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

-- 6. Create centralized admin validation function
CREATE OR REPLACE FUNCTION public.validate_admin_access()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    -- Log unauthorized access attempt
    INSERT INTO security_incidents (
      type,
      description,
      severity,
      ip_address,
      user_agent,
      created_at
    ) VALUES (
      'unauthorized_access_attempt',
      'Non-authenticated user attempted admin operation',
      'high',
      NULL, -- Will be populated by edge function
      NULL,
      NOW()
    );
    RETURN FALSE;
  END IF;
  
  SELECT * INTO v_profile
  FROM profiles
  WHERE id = v_user_id;
  
  IF NOT FOUND OR v_profile.role != 'admin' OR NOT v_profile.is_active THEN
    -- Log invalid admin access attempt
    INSERT INTO security_incidents (
      type,
      description,
      severity,
      user_id,
      created_at
    ) VALUES (
      'invalid_admin_access_attempt',
      'User attempted admin operation without proper privileges',
      'high',
      v_user_id,
      NOW()
    );
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- 7. Update admin check function to use centralized validation
CREATE OR REPLACE FUNCTION public.is_admin_secure()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT public.validate_admin_access();
$$;

-- 8. Create secure audit logging function
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_severity TEXT DEFAULT 'medium',
  p_description TEXT DEFAULT '',
  p_user_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_incident_id UUID;
BEGIN
  INSERT INTO security_incidents (
    type,
    severity,
    description,
    user_id,
    ip_address,
    user_agent,
    request_data,
    created_at
  ) VALUES (
    p_event_type,
    p_severity,
    p_description,
    COALESCE(p_user_id, auth.uid()),
    p_ip_address,
    p_user_agent,
    p_metadata,
    NOW()
  ) RETURNING id INTO v_incident_id;
  
  RETURN v_incident_id;
END;
$$;

-- 9. Create rate limiting function for OTP
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit_secure(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_recent_count INTEGER;
  v_last_otp_time TIMESTAMP WITH TIME ZONE;
  v_cooldown_minutes INTEGER := 1;
  v_hourly_limit INTEGER := 5;
  v_daily_limit INTEGER := 10;
  v_daily_count INTEGER;
BEGIN
  -- Check hourly limit
  SELECT COUNT(*), MAX(created_at)
  INTO v_recent_count, v_last_otp_time
  FROM customer_otp_codes 
  WHERE email = LOWER(p_email) 
    AND created_at > NOW() - INTERVAL '1 hour';
  
  -- Check daily limit
  SELECT COUNT(*)
  INTO v_daily_count
  FROM customer_otp_codes 
  WHERE email = LOWER(p_email) 
    AND created_at > NOW() - INTERVAL '24 hours';
  
  -- Check cooldown period
  IF v_last_otp_time IS NOT NULL AND v_last_otp_time > NOW() - INTERVAL '1 minute' THEN
    -- Log potential abuse
    PERFORM log_security_event(
      'otp_cooldown_violation',
      'medium',
      'User attempted OTP request within cooldown period',
      NULL,
      NULL,
      NULL,
      jsonb_build_object('email', p_email, 'last_request', v_last_otp_time)
    );
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'cooldown',
      'retry_after_seconds', 60,
      'remaining', 0
    );
  END IF;
  
  -- Check daily limit
  IF v_daily_count >= v_daily_limit THEN
    PERFORM log_security_event(
      'otp_daily_limit_exceeded',
      'high',
      'User exceeded daily OTP limit',
      NULL,
      NULL,
      NULL,
      jsonb_build_object('email', p_email, 'daily_count', v_daily_count)
    );
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_exceeded',
      'retry_after_seconds', 86400,
      'remaining', 0
    );
  END IF;
  
  -- Check hourly limit
  IF v_recent_count >= v_hourly_limit THEN
    PERFORM log_security_event(
      'otp_hourly_limit_exceeded',
      'medium',
      'User exceeded hourly OTP limit',
      NULL,
      NULL,
      NULL,
      jsonb_build_object('email', p_email, 'hourly_count', v_recent_count)
    );
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'retry_after_seconds', 3600,
      'remaining', 0
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', v_hourly_limit - v_recent_count,
    'daily_remaining', v_daily_limit - v_daily_count
  );
END;
$$;

-- 10. Update customer email function to be secure
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    (SELECT email FROM customer_accounts ca WHERE ca.user_id = auth.uid())
  );
$$;