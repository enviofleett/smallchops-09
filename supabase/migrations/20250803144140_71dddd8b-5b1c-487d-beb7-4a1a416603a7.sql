-- Fix the tables without RLS policies first
-- 1. Enable RLS and create policies for email_processing_queue
ALTER TABLE public.email_processing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service roles can manage email processing queue" 
ON public.email_processing_queue 
FOR ALL 
USING (auth.role() = 'service_role');

-- 2. Enable RLS and create policies for email_delivery_logs  
ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email delivery logs" 
ON public.email_delivery_logs 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Service roles can manage email delivery logs" 
ON public.email_delivery_logs 
FOR ALL 
USING (auth.role() = 'service_role');

-- 3. Enable RLS and create policies for smtp_delivery_logs
ALTER TABLE public.smtp_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view SMTP delivery logs" 
ON public.smtp_delivery_logs 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Service roles can manage SMTP delivery logs" 
ON public.smtp_delivery_logs 
FOR ALL 
USING (auth.role() = 'service_role');

-- 4. Enable RLS and create policies for email_bounce_tracking
ALTER TABLE public.email_bounce_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email bounce tracking" 
ON public.email_bounce_tracking 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Service roles can manage email bounce tracking" 
ON public.email_bounce_tracking 
FOR ALL 
USING (auth.role() = 'service_role');

-- 5. Enable RLS and create policies for smtp_rate_limits
ALTER TABLE public.smtp_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service roles can manage SMTP rate limits" 
ON public.smtp_rate_limits 
FOR ALL 
USING (auth.role() = 'service_role');

-- Add missing SET search_path to public functions that need it
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role::text FROM profiles WHERE id = user_uuid),
    'customer'
  );
$function$;

-- Add OTP rate limiting table for security
CREATE TABLE IF NOT EXISTS public.otp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  last_attempt TIMESTAMPTZ DEFAULT NOW(),
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on OTP rate limits
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service roles can manage OTP rate limits" 
ON public.otp_rate_limits 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create function to check OTP rate limits
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_record RECORD;
  v_max_attempts INTEGER := 5;
  v_window_minutes INTEGER := 60;
  v_block_duration INTEGER := 300; -- 5 minutes
BEGIN
  -- Get existing rate limit record
  SELECT * INTO v_record
  FROM otp_rate_limits
  WHERE email = p_email
  AND window_start > NOW() - INTERVAL '1 hour';
  
  -- If no record exists, create one
  IF v_record IS NULL THEN
    INSERT INTO otp_rate_limits (email, attempt_count)
    VALUES (p_email, 1);
    
    RETURN jsonb_build_object(
      'allowed', true,
      'attempts_remaining', v_max_attempts - 1
    );
  END IF;
  
  -- Check if currently blocked
  IF v_record.is_blocked AND v_record.last_attempt > NOW() - INTERVAL '5 minutes' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'blocked',
      'retry_after_seconds', EXTRACT(EPOCH FROM (v_record.last_attempt + INTERVAL '5 minutes' - NOW()))::INTEGER
    );
  END IF;
  
  -- Reset if window expired
  IF v_record.window_start < NOW() - INTERVAL '1 hour' THEN
    UPDATE otp_rate_limits
    SET attempt_count = 1,
        window_start = NOW(),
        last_attempt = NOW(),
        is_blocked = FALSE
    WHERE id = v_record.id;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'attempts_remaining', v_max_attempts - 1
    );
  END IF;
  
  -- Check if max attempts reached
  IF v_record.attempt_count >= v_max_attempts THEN
    UPDATE otp_rate_limits
    SET is_blocked = TRUE,
        last_attempt = NOW()
    WHERE id = v_record.id;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'retry_after_seconds', v_block_duration
    );
  END IF;
  
  -- Increment attempt count
  UPDATE otp_rate_limits
  SET attempt_count = attempt_count + 1,
      last_attempt = NOW()
  WHERE id = v_record.id;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'attempts_remaining', v_max_attempts - (v_record.attempt_count + 1)
  );
END;
$function$;