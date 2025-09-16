-- FIX CRITICAL SECURITY WARNINGS - Function Search Path Issues

-- Fix all functions with missing search_path parameter
ALTER FUNCTION public.audit_payment_transaction_changes() SET search_path = public;
ALTER FUNCTION public.log_payment_security_event(TEXT, JSONB, TEXT) SET search_path = public;  
ALTER FUNCTION public.check_production_payment_safety() SET search_path = public;
ALTER FUNCTION public.safe_update_order_status(UUID, TEXT, UUID) SET search_path = public;
ALTER FUNCTION public.upsert_communication_event(TEXT, TEXT, TEXT, JSONB, UUID, TEXT) SET search_path = public;
ALTER FUNCTION public.log_order_status_change_with_email() SET search_path = public;
ALTER FUNCTION public.process_queued_communication_events() SET search_path = public;
ALTER FUNCTION public.admin_queue_order_email(UUID, TEXT) SET search_path = public;
ALTER FUNCTION public.calculate_daily_delivery_analytics(DATE) SET search_path = public;
ALTER FUNCTION public.admin_safe_update_order_status(UUID, TEXT, UUID) SET search_path = public;
ALTER FUNCTION public.admin_safe_update_order_status_enhanced(UUID, TEXT, UUID) SET search_path = public;
ALTER FUNCTION public.upsert_communication_event_enhanced(TEXT, TEXT, TEXT, JSONB, UUID, TEXT) SET search_path = public;
ALTER FUNCTION public.log_payment_access(TEXT, UUID, UUID, TEXT) SET search_path = public;
ALTER FUNCTION public.secure_verify_payment(TEXT, NUMERIC, UUID) SET search_path = public;
ALTER FUNCTION public.encrypt_payment_data() SET search_path = public;
ALTER FUNCTION public.check_payment_rate_limit(UUID, TEXT) SET search_path = public;
ALTER FUNCTION public.check_otp_rate_limit(TEXT, INET) SET search_path = public;
ALTER FUNCTION public.check_api_rate_limit(TEXT, TEXT, INTEGER, INTEGER) SET search_path = public;
ALTER FUNCTION public.check_secure_api_rate_limit(TEXT, TEXT, INTEGER, INTEGER) SET search_path = public;
ALTER FUNCTION public.secure_payment_verification(TEXT, NUMERIC, UUID) SET search_path = public;

-- Move extensions from public schema to extensions schema (if they exist)
DO $$
BEGIN
  -- Move pg_trgm extension if it exists in public
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE SCHEMA IF NOT EXISTS extensions;
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
  
  -- Move uuid-ossp extension if it exists in public  
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE SCHEMA IF NOT EXISTS extensions;
    ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
  END IF;
END $$;

-- Update extension versions to latest where possible
DO $$
BEGIN
  -- This will be handled by Supabase automatically in most cases
  -- We just ensure the functions are properly secured
  NULL;
END $$;