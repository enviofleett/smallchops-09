-- Clean up remaining OTP functions that are no longer needed
DROP FUNCTION IF EXISTS public.cleanup_expired_otps();
DROP FUNCTION IF EXISTS public.check_otp_rate_limit(text, text);