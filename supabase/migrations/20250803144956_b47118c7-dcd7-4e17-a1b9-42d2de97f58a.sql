-- Create OTP rate limiting table for security
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