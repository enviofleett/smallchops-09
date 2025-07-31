-- Fix security linter warnings by updating functions with proper search_path
CREATE OR REPLACE FUNCTION public.log_api_request(
  p_endpoint TEXT,
  p_method TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_payload JSONB DEFAULT NULL,
  p_response_status INTEGER DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_error_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.api_request_logs (
    endpoint, method, ip_address, user_agent, request_payload,
    response_status, response_time_ms, customer_id, session_id, error_details
  ) VALUES (
    p_endpoint, p_method, p_ip_address, p_user_agent, p_request_payload,
    p_response_status, p_response_time_ms, p_customer_id, p_session_id, p_error_details
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_customer_rate_limit(
  p_customer_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_endpoint TEXT DEFAULT 'general',
  p_tier TEXT DEFAULT 'standard'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
  v_limit INTEGER;
  v_window_minutes INTEGER := 60;
BEGIN
  -- Set limits based on tier
  CASE p_tier
    WHEN 'premium' THEN v_limit := 1000;
    WHEN 'business' THEN v_limit := 500;
    ELSE v_limit := 100; -- standard
  END CASE;
  
  -- Count requests in the last hour
  SELECT COUNT(*) INTO v_count
  FROM public.customer_rate_limits
  WHERE (p_customer_id IS NULL OR customer_id = p_customer_id)
    AND (p_ip_address IS NULL OR ip_address = p_ip_address)
    AND endpoint = p_endpoint
    AND window_start > now() - interval '1 hour';
    
  IF v_count >= v_limit THEN
    RETURN false;
  END IF;
  
  -- Log this request
  INSERT INTO public.customer_rate_limits (customer_id, ip_address, endpoint, tier)
  VALUES (p_customer_id, p_ip_address, p_endpoint, p_tier);
  
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_security_incident(
  p_incident_type TEXT,
  p_severity TEXT DEFAULT 'medium',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_endpoint TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_incident_id UUID;
BEGIN
  INSERT INTO public.security_incidents (
    incident_type, severity, ip_address, user_agent, endpoint, details
  ) VALUES (
    p_incident_type, p_severity, p_ip_address, p_user_agent, p_endpoint, p_details
  ) RETURNING id INTO v_incident_id;
  
  RETURN v_incident_id;
END;
$function$;