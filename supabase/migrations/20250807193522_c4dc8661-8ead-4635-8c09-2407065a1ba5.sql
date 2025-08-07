-- Final batch: Complete all remaining function security fixes
ALTER FUNCTION cleanup_old_communication_events() SET search_path TO 'public';
ALTER FUNCTION cleanup_old_email_events() SET search_path TO 'public';
ALTER FUNCTION cleanup_old_guest_sessions() SET search_path TO 'public';
ALTER FUNCTION clear_cart_after_payment() SET search_path TO 'public';
ALTER FUNCTION confirm_payment_atomic(p_reference text, p_amount integer, p_paystack_data jsonb, p_confirmed_at timestamp with time zone) SET search_path TO 'public';
ALTER FUNCTION convert_guest_cart_to_customer(p_guest_session_id text, p_customer_id uuid) SET search_path TO 'public';
ALTER FUNCTION create_admin_session(p_user_id uuid, p_ip_address inet, p_user_agent text) SET search_path TO 'public';
ALTER FUNCTION create_customer_with_validation(p_name text, p_email text, p_phone text, p_admin_id uuid, p_send_welcome_email boolean, p_ip_address inet, p_user_agent text) SET search_path TO 'public';
ALTER FUNCTION create_logo_version(p_logo_url text, p_file_size bigint, p_file_type text, p_dimensions jsonb, p_uploaded_by uuid) SET search_path TO 'public';
ALTER FUNCTION create_missing_customer_account(p_user_id uuid) SET search_path TO 'public';
ALTER FUNCTION create_order_with_items(p_customer_id uuid, p_fulfillment_type text, p_delivery_address jsonb, p_pickup_point_id uuid, p_delivery_zone_id uuid, p_guest_session_id uuid, p_items jsonb) SET search_path TO 'public';
ALTER FUNCTION customer_purchased_product(customer_uuid uuid, product_uuid uuid) SET search_path TO 'public';
ALTER FUNCTION debug_payment_transaction_insert(p_order_id text, p_customer_email text, p_amount numeric, p_currency text, p_payment_method text, p_transaction_type text, p_status text) SET search_path TO 'public';
ALTER FUNCTION delete_customer_cascade(p_customer_id uuid) SET search_path TO 'public';
ALTER FUNCTION detect_abandoned_carts() SET search_path TO 'public';