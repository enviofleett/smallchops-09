-- Create user_profiles view for backward compatibility
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT 
    ca.user_id as id,
    ca.name as full_name,
    ca.phone as phone_number,
    ca.created_at,
    ca.updated_at,
    ca.email_verified as is_verified
FROM public.customer_accounts ca
WHERE ca.user_id IS NOT NULL;

-- Grant appropriate permissions
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_profiles TO anon;

-- Update OTP expiration to 10 minutes for customer_otp_codes
UPDATE public.customer_otp_codes 
SET expires_at = created_at + INTERVAL '10 minutes'
WHERE expires_at > created_at + INTERVAL '10 minutes';

-- Create function to validate phone numbers (international format)
CREATE OR REPLACE FUNCTION public.validate_phone_number(phone_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Basic international phone number validation
    -- Accepts formats like +1234567890, +12 345 678 9012, etc.
    RETURN phone_text ~ '^\+[1-9]\d{1,14}$' OR phone_text ~ '^\+[1-9][\d\s\-\(\)]{7,20}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update customer registration rate limit check to be more restrictive
CREATE OR REPLACE FUNCTION public.check_registration_rate_limit_secure(
    p_email TEXT,
    p_ip_address INET DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_email_count INTEGER;
    v_ip_count INTEGER;
    v_email_limit INTEGER := 5; -- Max 5 registrations per email per hour
    v_ip_limit INTEGER := 10; -- Max 10 registrations per IP per hour
    v_cooldown_period INTERVAL := '1 minute';
    v_last_attempt TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Check email-based rate limit (last hour)
    SELECT COUNT(*), MAX(created_at)
    INTO v_email_count, v_last_attempt
    FROM customer_otp_codes 
    WHERE email = LOWER(p_email) 
      AND created_at > NOW() - INTERVAL '1 hour'
      AND otp_type = 'registration';
    
    -- Check for cooldown period
    IF v_last_attempt IS NOT NULL AND v_last_attempt > NOW() - v_cooldown_period THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'cooldown_active',
            'retry_after_seconds', EXTRACT(EPOCH FROM (v_last_attempt + v_cooldown_period - NOW())),
            'remaining_attempts', 0
        );
    END IF;
    
    -- Check email rate limit
    IF v_email_count >= v_email_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'email_rate_limit_exceeded',
            'retry_after_seconds', 3600,
            'remaining_attempts', 0
        );
    END IF;
    
    -- Check IP-based rate limit if IP provided
    IF p_ip_address IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_ip_count
        FROM customer_otp_codes 
        WHERE created_at > NOW() - INTERVAL '1 hour'
          AND otp_type = 'registration'
          AND verification_metadata->>'ip_address' = p_ip_address::TEXT;
        
        IF v_ip_count >= v_ip_limit THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'reason', 'ip_rate_limit_exceeded',
                'retry_after_seconds', 3600,
                'remaining_attempts', 0
            );
        END IF;
    END IF;
    
    -- Allow registration
    RETURN jsonb_build_object(
        'allowed', true,
        'remaining_attempts', v_email_limit - v_email_count,
        'cooldown_seconds', EXTRACT(EPOCH FROM v_cooldown_period)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create comprehensive security logging function
CREATE OR REPLACE FUNCTION public.log_registration_security_event(
    p_event_type TEXT,
    p_email TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT TRUE,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.customer_auth_audit (
        email,
        action,
        success,
        ip_address,
        user_agent,
        metadata,
        created_at
    ) VALUES (
        LOWER(p_email),
        p_event_type,
        p_success,
        p_ip_address,
        p_user_agent,
        p_metadata || jsonb_build_object(
            'timestamp', NOW(),
            'event_type', p_event_type
        ),
        NOW()
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;