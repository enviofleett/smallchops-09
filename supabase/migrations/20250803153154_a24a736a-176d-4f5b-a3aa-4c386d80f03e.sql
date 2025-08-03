-- Create OTP codes table for secure OTP storage and verification
CREATE TABLE public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  otp_type TEXT NOT NULL CHECK (otp_type IN ('login', 'registration', 'password_reset')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  used_at TIMESTAMP WITH TIME ZONE NULL,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3
);

-- Create indexes for performance
CREATE INDEX idx_otp_codes_email_type ON public.otp_codes(email, otp_type);
CREATE INDEX idx_otp_codes_expires_at ON public.otp_codes(expires_at);
CREATE INDEX idx_otp_codes_created_at ON public.otp_codes(created_at);

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for OTP codes
CREATE POLICY "Service roles can manage OTP codes" 
ON public.otp_codes 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create function to clean up expired OTP codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.otp_codes 
  WHERE expires_at < NOW() OR created_at < NOW() - INTERVAL '1 day';
END;
$function$;

-- Create function to validate OTP
CREATE OR REPLACE FUNCTION public.validate_otp_code(
  p_email TEXT,
  p_otp_code TEXT,
  p_otp_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_otp_record RECORD;
  v_result JSONB;
BEGIN
  -- Get the most recent unused OTP for this email and type
  SELECT * INTO v_otp_record
  FROM public.otp_codes
  WHERE email = p_email 
    AND otp_type = p_otp_type
    AND is_used = FALSE
    AND expires_at > NOW()
    AND attempts < max_attempts
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'No valid OTP found'
    );
  END IF;

  -- Increment attempts
  UPDATE public.otp_codes
  SET attempts = attempts + 1
  WHERE id = v_otp_record.id;

  -- Check if OTP matches
  IF v_otp_record.otp_code = p_otp_code THEN
    -- Mark as used
    UPDATE public.otp_codes
    SET is_used = TRUE, used_at = NOW()
    WHERE id = v_otp_record.id;

    v_result := jsonb_build_object(
      'valid', true,
      'otp_id', v_otp_record.id
    );
  ELSE
    v_result := jsonb_build_object(
      'valid', false,
      'error', 'Invalid OTP code'
    );
  END IF;

  RETURN v_result;
END;
$function$;