-- Fix database function security warnings
-- Update all functions to use proper search_path and security settings

-- Update customer_purchased_product function
CREATE OR REPLACE FUNCTION public.customer_purchased_product(customer_uuid uuid, product_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- Update is_email_suppressed function
CREATE OR REPLACE FUNCTION public.is_email_suppressed(email_address text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.email_suppression_list 
    WHERE email_address = $1
  );
$function$;

-- Update update_customer_addresses_updated_at function
CREATE OR REPLACE FUNCTION public.update_customer_addresses_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update update_customer_preferences_updated_at function
CREATE OR REPLACE FUNCTION public.update_customer_preferences_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update update_review_helpfulness function
CREATE OR REPLACE FUNCTION public.update_review_helpfulness()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- Update trigger_enhanced_email_processing function
CREATE OR REPLACE FUNCTION public.trigger_enhanced_email_processing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  config_record RECORD;
BEGIN
  -- Get enhanced email configuration
  SELECT * INTO config_record FROM public.enhanced_email_config LIMIT 1;
  
  -- Only trigger for queued events if enhanced processing is enabled
  IF NEW.status = 'queued' AND COALESCE(config_record.instant_processing_enabled, true) THEN
    -- Add to processing queue with appropriate priority
    INSERT INTO public.email_processing_queue (
      event_id,
      priority,
      scheduled_for,
      max_attempts
    ) VALUES (
      NEW.id,
      CASE 
        WHEN NEW.priority = 'high' OR NEW.event_type = 'customer_welcome' THEN 'high'
        WHEN NEW.priority = 'low' THEN 'low'
        ELSE 'normal'
      END,
      NOW(),
      COALESCE(config_record.max_retries, 3)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update cleanup_old_communication_events function
CREATE OR REPLACE FUNCTION public.cleanup_old_communication_events()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- Update cleanup_expired_rate_limits function
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.enhanced_rate_limits WHERE window_end < NOW();
END;
$function$;

-- Create production health monitoring function
CREATE OR REPLACE FUNCTION public.get_production_health_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  health_status JSONB := '{}';
  db_connections INTEGER;
  payment_success_rate NUMERIC;
  error_count INTEGER;
  recent_transactions INTEGER;
BEGIN
  -- Check database connections
  SELECT count(*) INTO db_connections 
  FROM pg_stat_activity 
  WHERE state = 'active';
  
  -- Calculate payment success rate (last 24 hours)
  SELECT 
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / COUNT(*)) * 100, 2)
      ELSE 100 
    END INTO payment_success_rate
  FROM payment_transactions 
  WHERE created_at > NOW() - INTERVAL '24 hours';
  
  -- Count recent errors
  SELECT COUNT(*) INTO error_count
  FROM audit_logs 
  WHERE category = 'Error' 
  AND event_time > NOW() - INTERVAL '1 hour';
  
  -- Count recent transactions
  SELECT COUNT(*) INTO recent_transactions
  FROM payment_transactions
  WHERE created_at > NOW() - INTERVAL '1 hour';
  
  health_status := jsonb_build_object(
    'status', 'healthy',
    'timestamp', NOW(),
    'database', jsonb_build_object(
      'connections', db_connections,
      'status', CASE WHEN db_connections < 100 THEN 'healthy' ELSE 'warning' END
    ),
    'payments', jsonb_build_object(
      'success_rate', payment_success_rate,
      'recent_transactions', recent_transactions,
      'status', CASE 
        WHEN payment_success_rate >= 95 THEN 'healthy'
        WHEN payment_success_rate >= 85 THEN 'warning'
        ELSE 'critical'
      END
    ),
    'errors', jsonb_build_object(
      'recent_count', error_count,
      'status', CASE 
        WHEN error_count <= 5 THEN 'healthy'
        WHEN error_count <= 20 THEN 'warning'
        ELSE 'critical'
      END
    )
  );
  
  RETURN health_status;
END;
$function$;