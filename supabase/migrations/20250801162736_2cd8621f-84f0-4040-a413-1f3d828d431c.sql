-- Create OTP verification table
CREATE TABLE public.email_otp_verification (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'registration', 'password_reset')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_otp_verification ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Service roles can manage OTP codes" 
ON public.email_otp_verification 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_email_otp_email_purpose ON public.email_otp_verification(email, purpose);
CREATE INDEX idx_email_otp_expires_at ON public.email_otp_verification(expires_at);
CREATE INDEX idx_email_otp_code ON public.email_otp_verification(code) WHERE verified = false;

-- Add OTP email templates using correct column names
INSERT INTO public.enhanced_email_templates (template_key, template_name, subject_template, html_template, variables, template_type, is_active, created_by, category)
VALUES 
(
  'login_otp',
  'Login OTP Code',
  'Your Login Code - {{companyName}}',
  '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Code</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Login Code</h1>
    </div>
    
    <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="font-size: 18px; margin-bottom: 30px;">Hi {{customerName}},</p>
        
        <p style="font-size: 16px; margin-bottom: 30px;">Use this code to log in to your account:</p>
        
        <div style="background: #f8f9fa; border: 2px dashed #007bff; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
            <div style="font-size: 36px; font-weight: bold; color: #007bff; letter-spacing: 8px; font-family: monospace;">{{otpCode}}</div>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
            This code will expire in <strong>5 minutes</strong> for your security.
        </p>
        
        <p style="font-size: 14px; color: #666; margin-bottom: 30px;">
            If you didn''t request this code, please ignore this email or contact support if you have concerns.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            This is an automated message from {{companyName}}. Please do not reply to this email.
        </p>
    </div>
</body>
</html>',
  '{"customerName", "otpCode", "companyName"}',
  'transactional',
  true,
  (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1),
  'authentication'
),
(
  'registration_otp',
  'Registration Email Verification',
  'Verify Your Email - {{companyName}}',
  '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to {{companyName}}!</h1>
    </div>
    
    <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="font-size: 18px; margin-bottom: 30px;">Hi {{customerName}},</p>
        
        <p style="font-size: 16px; margin-bottom: 30px;">Welcome! Please verify your email address to complete your registration:</p>
        
        <div style="background: #f8f9fa; border: 2px dashed #28a745; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
            <div style="font-size: 36px; font-weight: bold; color: #28a745; letter-spacing: 8px; font-family: monospace;">{{otpCode}}</div>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
            Enter this code in the verification form to activate your account. This code will expire in <strong>5 minutes</strong>.
        </p>
        
        <p style="font-size: 14px; color: #666; margin-bottom: 30px;">
            If you didn''t create an account with us, please ignore this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            This is an automated message from {{companyName}}. Please do not reply to this email.
        </p>
    </div>
</body>
</html>',
  '{"customerName", "otpCode", "companyName"}',
  'transactional',
  true,
  (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1),
  'authentication'
),
(
  'password_reset_otp',
  'Password Reset Verification',
  'Password Reset Code - {{companyName}}',
  '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset</h1>
    </div>
    
    <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="font-size: 18px; margin-bottom: 30px;">Hi {{customerName}},</p>
        
        <p style="font-size: 16px; margin-bottom: 30px;">We received a request to reset your password. Use this code to proceed:</p>
        
        <div style="background: #f8f9fa; border: 2px dashed #dc3545; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
            <div style="font-size: 36px; font-weight: bold; color: #dc3545; letter-spacing: 8px; font-family: monospace;">{{otpCode}}</div>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
            This code will expire in <strong>5 minutes</strong> for your security.
        </p>
        
        <p style="font-size: 14px; color: #666; margin-bottom: 30px;">
            If you didn''t request a password reset, please ignore this email or contact support if you have concerns.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            This is an automated message from {{companyName}}. Please do not reply to this email.
        </p>
    </div>
</body>
</html>',
  '{"customerName", "otpCode", "companyName"}',
  'transactional',
  true,
  (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1),
  'authentication'
);

-- Create function to cleanup expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.email_otp_verification 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Create function to check OTP rate limit
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(p_email TEXT, p_purpose TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count OTPs sent in the last hour
  SELECT COUNT(*) INTO v_count
  FROM public.email_otp_verification
  WHERE email = p_email
    AND purpose = p_purpose
    AND created_at > NOW() - INTERVAL '1 hour';
    
  -- Allow max 5 OTPs per hour per email per purpose
  RETURN v_count < 5;
END;
$$;

-- Create updated_at trigger
CREATE TRIGGER update_email_otp_verification_timestamp
  BEFORE UPDATE ON public.email_otp_verification
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();