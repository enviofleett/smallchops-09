-- Continue securing remaining functions (Batch 2)
ALTER FUNCTION check_enhanced_rate_limit(p_user_id uuid, p_ip_address text, p_operation_type text, p_limit_per_minute integer, p_limit_per_hour integer) SET search_path TO 'public';
ALTER FUNCTION check_otp_rate_limit(p_email text) SET search_path TO 'public';
ALTER FUNCTION check_paystack_production_readiness() SET search_path TO 'public';
ALTER FUNCTION check_production_readiness() SET search_path TO 'public';
ALTER FUNCTION check_production_security() SET search_path TO 'public';
ALTER FUNCTION check_promotion_expiration() SET search_path TO 'public';
ALTER FUNCTION check_rate_limit_with_reputation(p_identifier text, p_identifier_type text) SET search_path TO 'public';
ALTER FUNCTION check_upload_rate_limit(p_user_id uuid) SET search_path TO 'public';
ALTER FUNCTION check_user_permission(user_id_param uuid, menu_key_param text, required_level_param text) SET search_path TO 'public';
ALTER FUNCTION cleanup_email_processing_data() SET search_path TO 'public';
ALTER FUNCTION cleanup_expired_admin_invitations() SET search_path TO 'public';
ALTER FUNCTION cleanup_expired_customer_otps() SET search_path TO 'public';
ALTER FUNCTION cleanup_expired_otp_codes() SET search_path TO 'public';
ALTER FUNCTION cleanup_expired_rate_limits() SET search_path TO 'public';
ALTER FUNCTION cleanup_monitoring_data() SET search_path TO 'public';