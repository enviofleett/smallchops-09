-- Fix SECURITY DEFINER table-valued functions to respect RLS policies
-- Only keep SECURITY DEFINER where absolutely necessary for administrative functions

-- Remove SECURITY DEFINER from functions that don't need elevated privileges
CREATE OR REPLACE FUNCTION public.calculate_driver_weekly_performance(p_driver_id uuid, p_week_start date)
RETURNS TABLE(orders_completed integer, orders_failed integer, total_fees numeric, avg_delivery_time numeric, avg_rating numeric)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(CASE WHEN d.status = 'completed' THEN 1 END)::integer as orders_completed,
    COUNT(CASE WHEN d.status = 'failed' THEN 1 END)::integer as orders_failed,
    COALESCE(SUM(d.delivery_fee), 0) as total_fees,
    COALESCE(AVG(d.delivery_time_minutes), 0) as avg_delivery_time,
    COALESCE(AVG(dr.rating), 0) as avg_rating
  FROM deliveries d
  LEFT JOIN delivery_ratings dr ON dr.delivery_id = d.id
  WHERE d.driver_id = p_driver_id
    AND d.completed_at >= p_week_start
    AND d.completed_at < p_week_start + INTERVAL '7 days';
END;
$function$;

-- Remove SECURITY DEFINER from email provider function (can use regular RLS)
CREATE OR REPLACE FUNCTION public.get_active_email_provider()
RETURNS TABLE(provider_name text, health_score numeric, is_active boolean)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  -- Only allow admin access through RLS
  IF NOT is_admin() THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    spc.provider_name,
    spc.health_score,
    spc.is_active
  FROM smtp_provider_configs spc
  WHERE spc.is_active = true
  ORDER BY spc.health_score DESC, spc.last_checked DESC
  LIMIT 1;
END;
$function$;

-- Keep SECURITY DEFINER for sensitive payment functions but ensure proper authorization
CREATE OR REPLACE FUNCTION public.get_active_paystack_config()
RETURNS TABLE(public_key text, test_mode boolean, secret_key text, webhook_secret text, environment text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Strict admin-only access for sensitive payment configuration
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  RETURN QUERY
  SELECT 
    CASE 
      WHEN psc.test_mode THEN psc.test_public_key 
      ELSE psc.live_public_key 
    END as public_key,
    psc.test_mode,
    CASE 
      WHEN psc.test_mode THEN psc.test_secret_key 
      ELSE psc.live_secret_key 
    END as secret_key,
    psc.webhook_secret,
    CASE 
      WHEN psc.test_mode THEN 'test' 
      ELSE 'live' 
    END as environment
  FROM paystack_secure_config psc
  WHERE psc.is_active = true
  ORDER BY psc.updated_at DESC
  LIMIT 1;
END;
$function$;

-- Remove SECURITY DEFINER from admin invitation metrics (use RLS instead)
CREATE OR REPLACE FUNCTION public.get_admin_invitation_metrics()
RETURNS TABLE(total_invitations bigint, pending_invitations bigint, accepted_invitations bigint, expired_invitations bigint, success_rate numeric)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  -- Only allow admin access through RLS
  IF NOT is_admin() THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    COUNT(*) as total_invitations,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_invitations,
    COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_invitations,
    COUNT(CASE WHEN status = 'expired' OR expires_at < NOW() THEN 1 END) as expired_invitations,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(CASE WHEN status = 'accepted' THEN 1 END)::numeric / COUNT(*)::numeric) * 100, 2)
      ELSE 0
    END as success_rate
  FROM admin_invitations;
END;
$function$;

-- Remove SECURITY DEFINER from orphaned customer detection (use RLS)
CREATE OR REPLACE FUNCTION public.detect_orphaned_customer_records()
RETURNS TABLE(email text, has_customer_record boolean, has_auth_user boolean, has_customer_account boolean, communication_events_count bigint, issue_type text)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  -- Only allow admin access through RLS
  IF NOT is_admin() THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH email_universe AS (
    SELECT DISTINCT c.email FROM customers c
    UNION
    SELECT DISTINCT ca.email FROM customer_accounts ca WHERE ca.email IS NOT NULL
    UNION  
    SELECT DISTINCT ce.recipient_email FROM communication_events ce WHERE ce.recipient_email IS NOT NULL
  )
  SELECT 
    eu.email,
    EXISTS(SELECT 1 FROM customers c WHERE c.email = eu.email) as has_customer_record,
    EXISTS(SELECT 1 FROM auth.users au WHERE au.email = eu.email) as has_auth_user,
    EXISTS(SELECT 1 FROM customer_accounts ca WHERE ca.email = eu.email) as has_customer_account,
    COALESCE((SELECT COUNT(*) FROM communication_events ce WHERE ce.recipient_email = eu.email), 0) as communication_events_count,
    CASE 
      WHEN NOT EXISTS(SELECT 1 FROM customers c WHERE c.email = eu.email) 
           AND EXISTS(SELECT 1 FROM auth.users au WHERE au.email = eu.email) THEN 'auth_user_without_customer'
      WHEN EXISTS(SELECT 1 FROM customers c WHERE c.email = eu.email) 
           AND NOT EXISTS(SELECT 1 FROM auth.users au WHERE au.email = eu.email) THEN 'customer_without_auth'
      WHEN NOT EXISTS(SELECT 1 FROM customer_accounts ca WHERE ca.email = eu.email) THEN 'missing_customer_account'
      ELSE 'complete'
    END as issue_type
  FROM email_universe eu
  ORDER BY eu.email;
END;
$function$;

-- Remove SECURITY DEFINER from payment health check (use RLS)
CREATE OR REPLACE FUNCTION public.check_payment_system_health()
RETURNS TABLE(metric text, value bigint, description text)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  -- Only allow admin access through RLS
  IF NOT is_admin() THEN
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 'inconsistent_orders', COUNT(*), 'Orders with successful payments but pending status'
  FROM orders o
  WHERE o.payment_status = 'paid' AND o.status = 'pending'
  
  UNION ALL
  
  SELECT 'orphaned_payments', COUNT(*), 'Payment transactions without corresponding orders'
  FROM payment_transactions pt
  WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = pt.order_id)
  
  UNION ALL
  
  SELECT 'failed_orders_24h', COUNT(*), 'Orders failed in last 24 hours'
  FROM orders o
  WHERE o.status = 'failed' AND o.created_at > NOW() - INTERVAL '24 hours';
END;
$function$;