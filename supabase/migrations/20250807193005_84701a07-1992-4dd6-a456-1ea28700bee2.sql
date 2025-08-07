-- Complete final batch of security fixes for remaining functions
ALTER FUNCTION bulk_safe_delete_products(product_ids uuid[]) SET search_path TO 'public';
ALTER FUNCTION bulk_update_payment_status_to_success() SET search_path TO 'public';
ALTER FUNCTION calculate_bogo_discount(p_promotion_id uuid, p_cart_items jsonb) SET search_path TO 'public';
ALTER FUNCTION calculate_brand_consistency_score() SET search_path TO 'public';
ALTER FUNCTION calculate_daily_email_metrics() SET search_path TO 'public';
ALTER FUNCTION calculate_daily_email_metrics(target_date date) SET search_path TO 'public';
ALTER FUNCTION calculate_profile_completion(customer_uuid uuid) SET search_path TO 'public';
ALTER FUNCTION calculate_sender_reputation(p_domain text) SET search_path TO 'public';
ALTER FUNCTION calculate_vat_breakdown(cart_items jsonb, delivery_fee numeric) SET search_path TO 'public';
ALTER FUNCTION can_send_email_to(email_address text, email_type text) SET search_path TO 'public';
ALTER FUNCTION check_admin_creation_rate_limit() SET search_path TO 'public';
ALTER FUNCTION check_admin_invitation_rate_limit(user_id_param uuid) SET search_path TO 'public';
ALTER FUNCTION check_customer_operation_rate_limit(p_admin_id uuid, p_operation text, p_limit integer) SET search_path TO 'public';
ALTER FUNCTION check_customer_rate_limit(p_customer_id uuid, p_ip_address inet, p_endpoint text, p_tier text) SET search_path TO 'public';
ALTER FUNCTION check_email_rate_limit(p_identifier text, p_email_type text) SET search_path TO 'public';