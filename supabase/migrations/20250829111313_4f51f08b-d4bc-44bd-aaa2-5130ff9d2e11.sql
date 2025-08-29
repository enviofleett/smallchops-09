-- Fix remaining SECURITY DEFINER table-valued functions
-- Part 3: Final batch of functions

-- Fix customer payment status functions - remove SECURITY DEFINER, use RLS
CREATE OR REPLACE FUNCTION public.get_customer_payment_status(p_order_id uuid)
RETURNS TABLE(order_id uuid, order_number text, payment_reference text, processing_stage text, overall_status text, error_message text)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  -- Customers can only see their own orders through RLS
  RETURN QUERY
  SELECT 
    ppl.order_id,
    o.order_number,
    ppl.payment_reference,
    ppl.processing_stage,
    CASE 
      WHEN o.status = 'confirmed' AND o.payment_status = 'paid' THEN 'completed'
      WHEN ppl.error_message IS NOT NULL THEN 'error'
      WHEN o.payment_status = 'pending' THEN 'pending'
      ELSE 'unknown'
    END as overall_status,
    ppl.error_message
  FROM payment_processing_logs ppl
  JOIN orders o ON o.id = ppl.order_id
  WHERE ppl.order_id = p_order_id
  ORDER BY ppl.created_at DESC
  LIMIT 10;
END;
$function$;

-- Fix secure customer payment status function - remove SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_customer_payment_status_secure(p_order_id uuid)
RETURNS TABLE(order_id uuid, order_number text, payment_reference text, processing_stage text, overall_status text, error_message text, last_updated timestamp with time zone)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  -- Customers can only see their own orders through RLS
  RETURN QUERY
  SELECT 
    ppl.order_id,
    o.order_number,
    ppl.payment_reference,
    ppl.processing_stage,
    CASE 
      WHEN o.status = 'confirmed' AND o.payment_status = 'paid' THEN 'completed'
      WHEN ppl.error_message IS NOT NULL THEN 'error'
      WHEN o.payment_status = 'pending' THEN 'pending'
      ELSE 'unknown'
    END as overall_status,
    ppl.error_message,
    ppl.created_at as last_updated
  FROM payment_processing_logs ppl
  JOIN orders o ON o.id = ppl.order_id
  WHERE ppl.order_id = p_order_id
  ORDER BY ppl.created_at DESC
  LIMIT 5;
END;
$function$;

-- Fix environment config - remove SECURITY DEFINER, use admin checks
CREATE OR REPLACE FUNCTION public.get_environment_config()
RETURNS TABLE(environment text, is_live_mode boolean, webhook_url text)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    CASE 
      WHEN psc.test_mode THEN 'test'
      ELSE 'live'
    END as environment,
    NOT psc.test_mode as is_live_mode,
    psc.webhook_url
  FROM paystack_secure_config psc
  WHERE psc.is_active = true
  LIMIT 1;
END;
$function$;

-- Fix public delivery zones - remove SECURITY DEFINER (public data)
CREATE OR REPLACE FUNCTION public.get_public_delivery_zones()
RETURNS TABLE(id uuid, name text, description text, base_fee numeric, is_active boolean)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    dz.id,
    dz.name,
    dz.description,
    dz.base_fee,
    dz.is_active
  FROM delivery_zones dz
  WHERE dz.is_active = true
  ORDER BY dz.name;
END;
$function$;

-- Fix public paystack config - remove SECURITY DEFINER for public data only
CREATE OR REPLACE FUNCTION public.get_public_paystack_config()
RETURNS TABLE(public_key text, test_mode boolean)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN psc.test_mode THEN psc.test_public_key 
      ELSE psc.live_public_key 
    END as public_key,
    psc.test_mode
  FROM paystack_secure_config psc
  WHERE psc.is_active = true
  LIMIT 1;
END;
$function$;

-- Fix email stats function - remove SECURITY DEFINER, use admin checks
CREATE OR REPLACE FUNCTION public.get_hourly_email_stats(start_time timestamp with time zone, end_time timestamp with time zone)
RETURNS TABLE(hour timestamp with time zone, sent_count bigint, failed_count bigint, bounce_count bigint)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    date_trunc('hour', sdc.created_at) as hour,
    COUNT(CASE WHEN sdc.delivery_status = 'sent' THEN 1 END) as sent_count,
    COUNT(CASE WHEN sdc.delivery_status = 'failed' THEN 1 END) as failed_count,
    COUNT(CASE WHEN sdc.delivery_status = 'bounced' THEN 1 END) as bounce_count
  FROM smtp_delivery_confirmations sdc
  WHERE sdc.created_at BETWEEN start_time AND end_time
  GROUP BY date_trunc('hour', sdc.created_at)
  ORDER BY hour;
END;
$function$;

-- Fix production metrics function - remove SECURITY DEFINER, use admin checks
CREATE OR REPLACE FUNCTION public.get_production_metrics()
RETURNS TABLE(total_products bigint, total_orders bigint, total_customers bigint, total_revenue numeric, system_uptime interval)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM products WHERE status = 'active') as total_products,
    (SELECT COUNT(*) FROM orders) as total_orders,
    (SELECT COUNT(*) FROM customers) as total_customers,
    (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE payment_status = 'paid') as total_revenue,
    NOW() - (SELECT MIN(created_at) FROM orders) as system_uptime;
END;
$function$;