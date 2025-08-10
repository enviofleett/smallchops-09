-- Fix linter ERROR: Set views to security invoker
ALTER VIEW public.orders_with_payment SET (security_invoker = on);

-- Fix linter WARN: Ensure SECURITY DEFINER functions have immutable search_path
ALTER FUNCTION public.validate_promotion_usage(p_promotion_id uuid, p_order_amount numeric, p_customer_email text, p_promotion_code text)
  SET search_path = public;

ALTER FUNCTION public.process_email_queue_manual(batch_size integer)
  SET search_path = public;

ALTER FUNCTION public.log_registration_debug(p_message text, p_level text, p_category text, p_details jsonb, p_user_id uuid, p_session_id text, p_ip_address inet, p_user_agent text)
  SET search_path = public;

ALTER FUNCTION public.link_guest_orders_to_customer()
  SET search_path = public;

ALTER FUNCTION public.test_registration_system()
  SET search_path = public;
