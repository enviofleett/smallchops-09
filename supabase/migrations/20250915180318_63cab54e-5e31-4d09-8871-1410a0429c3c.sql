-- Fix security warnings by updating functions to use proper search path
-- This addresses the "Function Search Path Mutable" warnings

-- Update functions that are missing SET search_path
ALTER FUNCTION public.safe_update_order_status(uuid, text, uuid) SET search_path TO 'public';
ALTER FUNCTION public.upsert_communication_event(text, text, text, text, jsonb, uuid, text) SET search_path TO 'public';
ALTER FUNCTION public.update_audit_logs_updated_at() SET search_path TO 'public';
ALTER FUNCTION public.update_user_favorites_updated_at() SET search_path TO 'public';
ALTER FUNCTION public.log_order_status_change_with_email() SET search_path TO 'public';
ALTER FUNCTION public.process_queued_communication_events() SET search_path TO 'public';
ALTER FUNCTION public.admin_queue_order_email(uuid, text) SET search_path TO 'public';
ALTER FUNCTION public.calculate_daily_delivery_analytics(date) SET search_path TO 'public';
ALTER FUNCTION public.upsert_communication_event(text, text, text, jsonb, uuid, text) SET search_path TO 'public';
ALTER FUNCTION public.activate_admin_user(uuid) SET search_path TO 'public';
ALTER FUNCTION public.clear_cart_after_payment() SET search_path TO 'public';
ALTER FUNCTION public.create_customer_record(text, text, text, uuid) SET search_path TO 'public';
ALTER FUNCTION public.deactivate_admin_user(uuid) SET search_path TO 'public';
ALTER FUNCTION public.execute_go_live_cleanup() SET search_path TO 'public';
ALTER FUNCTION public.get_active_paystack_config() SET search_path TO 'public';
ALTER FUNCTION public.trigger_email_processing() SET search_path TO 'public';
ALTER FUNCTION public.get_admin_invitation_metrics() SET search_path TO 'public';
ALTER FUNCTION public.get_available_delivery_slots() SET search_path TO 'public';
ALTER FUNCTION public.get_customer_payment_status(uuid) SET search_path TO 'public';
ALTER FUNCTION public.get_menu_structure_secure() SET search_path TO 'public';
ALTER FUNCTION public.handle_admin_invitation_signup() SET search_path TO 'public';
ALTER FUNCTION public.handle_new_customer_user() SET search_path TO 'public';
ALTER FUNCTION public.increment_discount_usage_count(uuid) SET search_path TO 'public';
ALTER FUNCTION public.check_otp_rate_limit(text, inet) SET search_path TO 'public';