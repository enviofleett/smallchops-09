-- Fix remaining database function security warnings by setting search_path

-- Batch 1: Critical security functions
ALTER FUNCTION public.bulk_safe_delete_products(text[]) SET search_path TO 'public';
ALTER FUNCTION public.bulk_update_payment_status_to_success(text[]) SET search_path TO 'public';
ALTER FUNCTION public.calculate_bogo_discount(numeric, text) SET search_path TO 'public';
ALTER FUNCTION public.calculate_daily_email_metrics() SET search_path TO 'public';
ALTER FUNCTION public.calculate_profile_completion(uuid) SET search_path TO 'public';
ALTER FUNCTION public.calculate_sender_reputation() SET search_path TO 'public';
ALTER FUNCTION public.calculate_vat_breakdown(numeric, numeric) SET search_path TO 'public';
ALTER FUNCTION public.can_send_email_to(text, text) SET search_path TO 'public';
ALTER FUNCTION public.check_admin_invitation_rate_limit() SET search_path TO 'public';
ALTER FUNCTION public.check_customer_rate_limit(uuid, text, integer) SET search_path TO 'public';

-- Batch 2: Rate limiting and validation functions
ALTER FUNCTION public.check_email_rate_limit(text, text, integer, integer) SET search_path TO 'public';
ALTER FUNCTION public.check_promotion_expiration() SET search_path TO 'public';
ALTER FUNCTION public.check_rate_limit_with_reputation(text, text, integer) SET search_path TO 'public';
ALTER FUNCTION public.check_user_permission(uuid, text) SET search_path TO 'public';
ALTER FUNCTION public.cleanup_email_processing_data() SET search_path TO 'public';
ALTER FUNCTION public.cleanup_expired_admin_invitations() SET search_path TO 'public';
ALTER FUNCTION public.cleanup_expired_customer_otps() SET search_path TO 'public';
ALTER FUNCTION public.cleanup_expired_otp_codes() SET search_path TO 'public';
ALTER FUNCTION public.cleanup_monitoring_data() SET search_path TO 'public';
ALTER FUNCTION public.cleanup_old_email_events() SET search_path TO 'public';

-- Batch 3: Customer and order management functions
ALTER FUNCTION public.cleanup_old_guest_sessions() SET search_path TO 'public';
ALTER FUNCTION public.clear_cart_after_payment(uuid) SET search_path TO 'public';
ALTER FUNCTION public.confirm_payment_atomic(text, timestamp with time zone, text, numeric, text) SET search_path TO 'public';
ALTER FUNCTION public.convert_guest_cart_to_customer(uuid, uuid) SET search_path TO 'public';
ALTER FUNCTION public.create_admin_session(uuid, text, inet) SET search_path TO 'public';
ALTER FUNCTION public.create_customer_with_validation(text, text, text, uuid, inet, text) SET search_path TO 'public';
ALTER FUNCTION public.create_missing_customer_account(text, text, text) SET search_path TO 'public';
ALTER FUNCTION public.debug_payment_transaction_insert(uuid, text, numeric) SET search_path TO 'public';
ALTER FUNCTION public.delete_customer_cascade(uuid, uuid, inet, text) SET search_path TO 'public';
ALTER FUNCTION public.detect_abandoned_carts() SET search_path TO 'public';