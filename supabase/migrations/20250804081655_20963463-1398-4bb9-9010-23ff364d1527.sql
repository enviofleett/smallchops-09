-- Fix missing RLS policies for newly created tables
-- These are critical security fixes for production

-- RLS policies for email_bounce_tracking
CREATE POLICY "Admins can view email bounces" 
ON email_bounce_tracking FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Service roles can manage email bounces" 
ON email_bounce_tracking FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS policies for smtp_delivery_confirmations  
CREATE POLICY "Admins can view SMTP confirmations" 
ON smtp_delivery_confirmations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Service roles can manage SMTP confirmations" 
ON smtp_delivery_confirmations FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS policies for enhanced_rate_limits
CREATE POLICY "Service roles can manage enhanced rate limits" 
ON enhanced_rate_limits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS policies for smtp_health_metrics
CREATE POLICY "Admins can view SMTP health metrics" 
ON smtp_health_metrics FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Service roles can manage SMTP health metrics" 
ON smtp_health_metrics FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix function search paths for security (add SET search_path TO 'public')
CREATE OR REPLACE FUNCTION public.record_smtp_health(
  p_provider_name text,
  p_status text,
  p_response_time_ms integer DEFAULT NULL,
  p_error_details text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_metric_id uuid;
BEGIN
  INSERT INTO smtp_health_metrics (
    provider_name,
    status,
    response_time_ms,
    error_details
  ) VALUES (
    p_provider_name,
    p_status,
    p_response_time_ms,
    p_error_details
  ) RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_rate_limit_counter(
  p_identifier text,
  p_identifier_type text DEFAULT 'email'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_count integer;
  v_window_start timestamp with time zone;
  v_limit_record record;
BEGIN
  v_window_start := date_trunc('hour', now());
  
  -- Get or create rate limit record
  SELECT * INTO v_limit_record
  FROM enhanced_rate_limits
  WHERE identifier = p_identifier 
    AND identifier_type = p_identifier_type
    AND window_start = v_window_start;
    
  IF v_limit_record IS NULL THEN
    -- Create new record
    INSERT INTO enhanced_rate_limits (
      identifier, identifier_type, window_start, request_count
    ) VALUES (
      p_identifier, p_identifier_type, v_window_start, 1
    );
    v_current_count := 1;
  ELSE
    -- Update existing record
    UPDATE enhanced_rate_limits 
    SET request_count = request_count + 1,
        window_end = now()
    WHERE id = v_limit_record.id;
    v_current_count := v_limit_record.request_count + 1;
  END IF;
  
  RETURN jsonb_build_object(
    'identifier', p_identifier,
    'current_count', v_current_count,
    'window_start', v_window_start
  );
END;
$$;

-- Secure other critical functions
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(
  p_email text,
  p_ip_address inet DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email_count integer := 0;
  v_ip_count integer := 0;
  v_result jsonb;
  v_time_window timestamp with time zone := now() - interval '1 hour';
BEGIN
  -- Check email-based rate limit (max 3 per hour)
  SELECT COUNT(*) INTO v_email_count
  FROM customer_otp_codes
  WHERE email = p_email
    AND created_at > v_time_window;
    
  -- Check IP-based rate limit (max 10 per hour)
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO v_ip_count
    FROM customer_otp_codes
    WHERE created_by_ip = p_ip_address
      AND created_at > v_time_window;
  END IF;
  
  v_result := jsonb_build_object(
    'allowed', (v_email_count < 3 AND v_ip_count < 10),
    'email_count', v_email_count,
    'ip_count', v_ip_count,
    'email_limit', 3,
    'ip_limit', 10,
    'window_reset_at', date_trunc('hour', now()) + interval '1 hour'
  );
  
  RETURN v_result;
END;
$$;

-- Add audit logging for production security
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'production_security_hardening',
  'Security',
  'Applied production security hardening: RLS policies and function security',
  jsonb_build_object(
    'policies_added', 8,
    'functions_secured', 3,
    'timestamp', now()
  )
);