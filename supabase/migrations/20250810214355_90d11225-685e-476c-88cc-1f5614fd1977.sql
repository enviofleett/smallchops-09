-- Set immutable search_path on remaining functions flagged by linter
ALTER FUNCTION public.log_profile_activity(p_customer_id uuid, p_action_type text, p_field_changed text, p_old_value text, p_new_value text, p_ip_address inet, p_user_agent text)
  SET search_path = public;

ALTER FUNCTION public.update_catering_bookings_updated_at()
  SET search_path = public;

ALTER FUNCTION public.generate_order_number()
  SET search_path = public;
