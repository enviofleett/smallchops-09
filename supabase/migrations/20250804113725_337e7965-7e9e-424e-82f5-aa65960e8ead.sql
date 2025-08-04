-- Phase 1D: Fix ALL remaining database functions with missing search_path
-- Complete security fixes for entire system

-- Fix update functions
CREATE OR REPLACE FUNCTION public.update_customer_addresses_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_catalog
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_customer_preferences_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_catalog
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_review_helpfulness()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  review_uuid UUID;
  helpful_count INTEGER;
  total_count INTEGER;
BEGIN
  -- Get the review_id from either NEW or OLD record
  review_uuid := COALESCE(NEW.review_id, OLD.review_id);
  
  -- Calculate vote counts
  SELECT 
    COUNT(*) FILTER (WHERE vote_type = 'helpful'),
    COUNT(*)
  INTO helpful_count, total_count
  FROM public.review_votes 
  WHERE review_id = review_uuid;
  
  -- Update the review
  UPDATE public.product_reviews 
  SET 
    helpful_votes = COALESCE(helpful_count, 0),
    total_votes = COALESCE(total_count, 0),
    updated_at = NOW()
  WHERE id = review_uuid;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.customer_purchased_product(customer_uuid uuid, product_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.orders o
    JOIN public.order_items oi ON o.id = oi.order_id
    JOIN public.customer_accounts ca ON o.customer_email = ca.name OR o.customer_email = ca.phone
    WHERE ca.id = customer_uuid 
    AND oi.product_id = product_uuid 
    AND o.status = 'completed'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_communication_events()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
BEGIN
  -- Delete events older than 90 days, except failed ones (keep for analysis)
  DELETE FROM communication_events 
  WHERE created_at < NOW() - INTERVAL '90 days' 
  AND status != 'failed';
  
  -- Delete very old failed events (older than 1 year)
  DELETE FROM communication_events 
  WHERE created_at < NOW() - INTERVAL '1 year' 
  AND status = 'failed';
  
  -- Clean up old email delivery logs (older than 6 months)
  DELETE FROM email_delivery_logs 
  WHERE created_at < NOW() - INTERVAL '6 months';
  
  -- Log cleanup operation
  INSERT INTO audit_logs (action, category, message) 
  VALUES ('cleanup_communication_data', 'System Maintenance', 'Cleaned up old communication events and delivery logs');
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_branding_change(p_action text, p_field_name text, p_old_value text, p_new_value text, p_metadata jsonb DEFAULT '{}'::jsonb, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.branding_audit_log (
    user_id, action, field_name, old_value, new_value, 
    metadata, ip_address, user_agent
  ) VALUES (
    auth.uid(), p_action, p_field_name, p_old_value, p_new_value,
    p_metadata, p_ip_address, p_user_agent
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_customer_operation_rate_limit(p_admin_id uuid, p_operation text, p_limit integer DEFAULT 50)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count operations in the last hour
  SELECT COUNT(*) INTO v_count
  FROM audit_logs
  WHERE user_id = p_admin_id
    AND action LIKE '%customer%'
    AND action LIKE '%' || p_operation || '%'
    AND event_time > NOW() - INTERVAL '1 hour';
    
  RETURN v_count < p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_payment_transaction_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_api_request(p_endpoint text, p_method text, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text, p_request_payload jsonb DEFAULT NULL::jsonb, p_response_status integer DEFAULT NULL::integer, p_response_time_ms integer DEFAULT NULL::integer, p_customer_id uuid DEFAULT NULL::uuid, p_session_id text DEFAULT NULL::text, p_error_details jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.api_request_logs (
    endpoint, method, ip_address, user_agent, request_payload,
    response_status, response_time_ms, customer_id, session_id, error_details
  ) VALUES (
    p_endpoint, p_method, p_ip_address, p_user_agent, p_request_payload,
    p_response_status, p_response_time_ms, p_customer_id, p_session_id, p_error_details
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$;