-- Complete final search_path security fixes
ALTER FUNCTION cleanup_expired_admin_invitations() SET search_path TO 'public';
ALTER FUNCTION cleanup_expired_customer_otps() SET search_path TO 'public';
ALTER FUNCTION cleanup_expired_otp_codes() SET search_path TO 'public';
ALTER FUNCTION cleanup_monitoring_data() SET search_path TO 'public';
ALTER FUNCTION cleanup_old_email_events() SET search_path TO 'public';
ALTER FUNCTION cleanup_old_guest_sessions() SET search_path TO 'public';
ALTER FUNCTION confirm_payment_atomic(text, integer, jsonb, timestamp with time zone) SET search_path TO 'public';
ALTER FUNCTION convert_guest_cart_to_customer(text, uuid) SET search_path TO 'public';
ALTER FUNCTION create_admin_session(uuid, inet, text) SET search_path TO 'public';
ALTER FUNCTION create_customer_with_validation(text, text, text, uuid, boolean, inet, text) SET search_path TO 'public';
ALTER FUNCTION create_missing_customer_account(uuid) SET search_path TO 'public';
ALTER FUNCTION customer_purchased_product(uuid, uuid) SET search_path TO 'public';
ALTER FUNCTION debug_payment_transaction_insert(text, text, numeric, text, text, text, text) SET search_path TO 'public';