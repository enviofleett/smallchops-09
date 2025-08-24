-- SMTP Production Readiness Migration
-- Phase 1: Database hardening and cleanup

-- Create missing RPCs for production email system
CREATE OR REPLACE FUNCTION public.get_active_email_provider()
RETURNS TABLE(provider_name text, health_score numeric, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    spc.provider_name,
    spc.health_score,
    spc.is_active
  FROM smtp_provider_configs spc
  WHERE spc.is_active = true
  ORDER BY spc.health_score DESC, spc.last_checked DESC
  LIMIT 1;
END;
$$;

-- Enhanced email delivery logging function
CREATE OR REPLACE FUNCTION public.log_email_delivery(
  p_message_id text,
  p_recipient_email text,
  p_subject text,
  p_provider text,
  p_status text,
  p_template_key text DEFAULT NULL,
  p_variables jsonb DEFAULT '{}',
  p_smtp_response text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert into delivery confirmations
  INSERT INTO smtp_delivery_confirmations (
    email_id,
    recipient_email,
    provider_used,
    delivery_status,
    message_id,
    provider_response,
    created_at
  ) VALUES (
    p_message_id,
    p_recipient_email,
    p_provider,
    p_status,
    p_message_id,
    jsonb_build_object('response', p_smtp_response),
    NOW()
  );

  -- Insert into SMTP delivery logs
  INSERT INTO smtp_delivery_logs (
    email_id,
    recipient_email,
    subject,
    delivery_status,
    provider,
    smtp_response,
    delivery_timestamp,
    metadata
  ) VALUES (
    p_message_id,
    p_recipient_email,
    p_subject,
    p_status,
    p_provider,
    p_smtp_response,
    NOW(),
    jsonb_build_object(
      'template_key', p_template_key,
      'variables', p_variables,
      'logged_at', NOW()
    )
  );
END;
$$;

-- Rate limiting function for production use
CREATE OR REPLACE FUNCTION public.check_email_rate_limit(
  p_recipient_email text,
  p_window_minutes integer DEFAULT 60,
  p_max_emails integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email_count integer;
  v_window_start timestamp with time zone;
BEGIN
  v_window_start := NOW() - (p_window_minutes || ' minutes')::interval;
  
  -- Count emails sent to this recipient in the time window
  SELECT COUNT(*) INTO v_email_count
  FROM smtp_delivery_confirmations
  WHERE recipient_email = LOWER(p_recipient_email)
    AND created_at > v_window_start
    AND delivery_status = 'sent';
  
  RETURN jsonb_build_object(
    'allowed', v_email_count < p_max_emails,
    'current_count', v_email_count,
    'limit', p_max_emails,
    'window_minutes', p_window_minutes,
    'reset_at', NOW() + (p_window_minutes || ' minutes')::interval,
    'reason', CASE 
      WHEN v_email_count >= p_max_emails THEN 'rate_limit_exceeded'
      ELSE 'allowed'
    END
  );
END;
$$;

-- Health monitoring function for SMTP providers
CREATE OR REPLACE FUNCTION public.record_smtp_health_metric(
  p_provider_name text,
  p_metric_type text,
  p_metric_value numeric,
  p_threshold_value numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO smtp_health_metrics (
    provider_name,
    metric_type,
    metric_value,
    threshold_value,
    threshold_breached,
    recorded_at
  ) VALUES (
    p_provider_name,
    p_metric_type,
    p_metric_value,
    p_threshold_value,
    CASE 
      WHEN p_threshold_value IS NOT NULL THEN p_metric_value > p_threshold_value
      ELSE false
    END,
    NOW()
  );
  
  -- Update provider health score if this is a health check
  IF p_metric_type = 'connection_test' THEN
    UPDATE smtp_provider_configs 
    SET 
      health_score = CASE 
        WHEN p_metric_value = 1 THEN LEAST(health_score + 10, 100)
        ELSE GREATEST(health_score - 20, 0)
      END,
      last_checked = NOW(),
      consecutive_failures = CASE 
        WHEN p_metric_value = 1 THEN 0
        ELSE consecutive_failures + 1
      END
    WHERE provider_name = p_provider_name;
  END IF;
END;
$$;

-- Cleanup function for old email logs
CREATE OR REPLACE FUNCTION public.cleanup_old_email_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Keep only last 30 days of delivery confirmations
  DELETE FROM smtp_delivery_confirmations 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Keep only last 90 days of health metrics
  DELETE FROM smtp_health_metrics 
  WHERE recorded_at < NOW() - INTERVAL '90 days';
  
  -- Archive old communication events
  INSERT INTO communication_events_archive 
  SELECT * FROM communication_events 
  WHERE created_at < NOW() - INTERVAL '7 days' 
    AND status IN ('sent', 'failed');
  
  DELETE FROM communication_events 
  WHERE created_at < NOW() - INTERVAL '7 days' 
    AND status IN ('sent', 'failed');
END;
$$;