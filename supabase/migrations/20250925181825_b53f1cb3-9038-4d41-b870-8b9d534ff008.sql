-- Drop and recreate missing database functions

-- Drop existing functions that need to be recreated
DROP FUNCTION IF EXISTS public.log_customer_operation(text, uuid, jsonb, uuid, inet, text);
DROP FUNCTION IF EXISTS public.log_customer_operation(text, uuid, jsonb);

-- Function: check_rate_limit_secure
CREATE OR REPLACE FUNCTION public.check_rate_limit_secure(
    p_identifier TEXT,
    p_limit_type TEXT,
    p_max_requests INTEGER,
    p_window_minutes INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_window_start TIMESTAMP;
    v_current_count INTEGER;
    v_reset_time TIMESTAMP;
BEGIN
    -- Calculate window start time
    v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
    v_reset_time := NOW() + (p_window_minutes || ' minutes')::INTERVAL;
    
    -- Get current request count in the window
    SELECT COUNT(*) INTO v_current_count
    FROM audit_logs
    WHERE action = p_limit_type
    AND COALESCE(user_id::TEXT, ip_address::TEXT) = p_identifier
    AND created_at >= v_window_start;
    
    -- Check if limit exceeded
    IF v_current_count >= p_max_requests THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'reset_time', v_reset_time
        );
    END IF;
    
    -- Record this request if within limits
    INSERT INTO audit_logs (action, category, message, new_values, ip_address)
    VALUES (
        p_limit_type,
        'Rate Limiting',
        'Rate limit check',
        jsonb_build_object(
            'count', v_current_count + 1,
            'max', p_max_requests,
            'window_minutes', p_window_minutes,
            'identifier', p_identifier
        ),
        p_identifier::INET
    );
    
    RETURN jsonb_build_object(
        'allowed', true,
        'remaining', p_max_requests - (v_current_count + 1),
        'reset_time', v_reset_time
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Fail open for production stability
    RETURN jsonb_build_object(
        'allowed', true,
        'remaining', p_max_requests,
        'reset_time', v_reset_time,
        'error', SQLERRM
    );
END;
$$;

-- Function: log_customer_operation
CREATE OR REPLACE FUNCTION public.log_customer_operation(
    p_operation TEXT,
    p_customer_id UUID,
    p_details JSONB,
    p_admin_id UUID DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO audit_logs (
        action,
        category,
        message,
        user_id,
        entity_id,
        new_values,
        ip_address,
        user_agent
    ) VALUES (
        'customer_' || p_operation,
        'Customer Management',
        'Customer operation: ' || p_operation,
        p_admin_id,
        p_customer_id,
        p_details,
        p_ip_address,
        p_user_agent
    );
END;
$$;

-- Function: is_admin (ensure it exists)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_is_admin BOOLEAN := FALSE;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if user is admin in profiles table
    SELECT COALESCE(is_admin, FALSE) INTO v_is_admin
    FROM profiles
    WHERE id = v_user_id
    AND COALESCE(is_active, TRUE) = TRUE;
    
    RETURN COALESCE(v_is_admin, FALSE);
    
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;