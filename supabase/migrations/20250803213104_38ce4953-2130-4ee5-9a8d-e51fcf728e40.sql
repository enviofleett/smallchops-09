-- Phase 1: Database Schema Enhancements for Customer Authentication

-- Add email verification tracking to customer_accounts
ALTER TABLE public.customer_accounts 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP WITH TIME ZONE;

-- Create enhanced OTP codes table with customer-specific tracking
CREATE TABLE IF NOT EXISTS public.customer_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  otp_type TEXT NOT NULL CHECK (otp_type IN ('registration', 'login', 'password_reset', 'email_verification')),
  customer_id UUID REFERENCES public.customer_accounts(id),
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_ip INET,
  verification_metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on customer OTP codes
ALTER TABLE public.customer_otp_codes ENABLE ROW LEVEL SECURITY;

-- Create index for faster OTP lookups
CREATE INDEX IF NOT EXISTS idx_customer_otp_codes_email_type 
ON public.customer_otp_codes(email, otp_type, expires_at);

-- Create index for cleanup
CREATE INDEX IF NOT EXISTS idx_customer_otp_codes_expires_at 
ON public.customer_otp_codes(expires_at);

-- RLS policies for customer OTP codes
CREATE POLICY "Service roles can manage customer OTP codes" 
ON public.customer_otp_codes 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create customer authentication audit log
CREATE TABLE IF NOT EXISTS public.customer_auth_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customer_accounts(id),
  email TEXT NOT NULL,
  action TEXT NOT NULL, -- 'registration', 'login', 'logout', 'otp_verification', 'password_reset'
  success BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on customer auth audit
ALTER TABLE public.customer_auth_audit ENABLE ROW LEVEL SECURITY;

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_customer_auth_audit_email_action 
ON public.customer_auth_audit(email, action, created_at);

-- RLS policies for customer auth audit
CREATE POLICY "Admins can view customer auth audit" 
ON public.customer_auth_audit 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Service roles can manage customer auth audit" 
ON public.customer_auth_audit 
FOR ALL 
USING (auth.role() = 'service_role');

-- Function to clean up expired OTP codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_customer_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.customer_otp_codes 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Function to verify customer OTP
CREATE OR REPLACE FUNCTION public.verify_customer_otp(
  p_email TEXT,
  p_otp_code TEXT,
  p_otp_type TEXT,
  p_ip_address INET DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp_record RECORD;
  v_customer_id UUID;
  v_result JSONB;
BEGIN
  -- Find valid OTP
  SELECT * INTO v_otp_record
  FROM public.customer_otp_codes
  WHERE email = p_email
    AND otp_code = p_otp_code
    AND otp_type = p_otp_type
    AND expires_at > NOW()
    AND used_at IS NULL
    AND attempts < max_attempts
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- Log failed attempt
    INSERT INTO public.customer_auth_audit (
      email, action, success, ip_address, failure_reason, metadata
    ) VALUES (
      p_email, 'otp_verification', false, p_ip_address, 
      'Invalid or expired OTP', 
      jsonb_build_object('otp_type', p_otp_type)
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired OTP code'
    );
  END IF;

  -- Mark OTP as used
  UPDATE public.customer_otp_codes
  SET used_at = NOW(),
      attempts = attempts + 1
  WHERE id = v_otp_record.id;

  -- Get or create customer account
  IF p_otp_type = 'registration' THEN
    -- For registration, create customer account if it doesn't exist
    INSERT INTO public.customer_accounts (
      user_id, name, email, email_verified
    ) VALUES (
      auth.uid(), 
      COALESCE((SELECT name FROM auth.users WHERE id = auth.uid()), split_part(p_email, '@', 1)),
      p_email,
      true
    ) 
    ON CONFLICT (user_id) DO UPDATE SET
      email_verified = true,
      updated_at = NOW()
    RETURNING id INTO v_customer_id;
  ELSE
    -- For other types, find existing customer
    SELECT id INTO v_customer_id
    FROM public.customer_accounts
    WHERE email = p_email;
  END IF;

  -- Log successful verification
  INSERT INTO public.customer_auth_audit (
    customer_id, email, action, success, ip_address, metadata
  ) VALUES (
    v_customer_id, p_email, 'otp_verification', true, p_ip_address,
    jsonb_build_object('otp_type', p_otp_type, 'otp_id', v_otp_record.id)
  );

  v_result := jsonb_build_object(
    'success', true,
    'customer_id', v_customer_id,
    'email_verified', true
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    INSERT INTO public.customer_auth_audit (
      email, action, success, ip_address, failure_reason, metadata
    ) VALUES (
      p_email, 'otp_verification', false, p_ip_address,
      'Database error: ' || SQLERRM,
      jsonb_build_object('otp_type', p_otp_type)
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Verification failed due to system error'
    );
END;
$$;