-- Clean up orphaned OTP table since OTP functionality has been removed
DROP TABLE IF EXISTS public.email_otp_verification;