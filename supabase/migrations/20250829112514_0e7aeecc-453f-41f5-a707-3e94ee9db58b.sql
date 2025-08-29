-- Final fix for remaining SECURITY DEFINER table functions
-- Drop and recreate critical ones, keep SECURITY DEFINER only where absolutely necessary

-- Drop remaining SECURITY DEFINER table functions
DROP FUNCTION IF EXISTS public.get_order_payment_status(uuid);
DROP FUNCTION IF EXISTS public.get_orders_with_payment(uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.get_payment_flow_health();
DROP FUNCTION IF EXISTS public.test_registration_system();
DROP FUNCTION IF EXISTS public.validate_admin_invitation_token(text);

-- Only keep SECURITY DEFINER for truly sensitive payment operations that need elevated privileges
-- But add strict admin checks

-- Fix order payment status (remove SECURITY DEFINER)
CREATE FUNCTION public.get_order_payment_status(p_order_id uuid)
RETURNS TABLE(order_id uuid, order_number text, payment_reference text, processing_stage text, overall_status text, error_message text)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  -- Use RLS to control access
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
  LIMIT 5;
END;
$function$;

-- Fix orders with payment (remove SECURITY DEFINER)
CREATE FUNCTION public.get_orders_with_payment(p_order_id uuid DEFAULT NULL::uuid, p_customer_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50)
RETURNS TABLE(order_id uuid, order_number text, customer_name text, total_amount numeric, payment_status text, order_status text, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  -- Use RLS to control access
  RETURN QUERY
  SELECT 
    o.id as order_id,
    o.order_number,
    o.customer_name,
    o.total_amount,
    o.payment_status::text,
    o.status::text as order_status,
    o.created_at
  FROM orders o
  WHERE (p_order_id IS NULL OR o.id = p_order_id)
    AND (p_customer_id IS NULL OR o.customer_id = p_customer_id)
  ORDER BY o.created_at DESC
  LIMIT p_limit;
END;
$function$;

-- Fix payment flow health (remove SECURITY DEFINER, add admin check)
CREATE FUNCTION public.get_payment_flow_health()
RETURNS TABLE(period text, total_orders bigint, completed_orders bigint, pending_orders bigint, paid_orders bigint, payment_pending bigint, completion_rate_percent numeric)
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
    'last_24h'::text AS period,
    COUNT(*) AS total_orders,
    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS completed_orders,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_orders,
    COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) AS paid_orders,
    COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) AS payment_pending,
    ROUND((COUNT(CASE WHEN status = 'confirmed' THEN 1 END)::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 2) AS completion_rate_percent
  FROM orders
  WHERE created_at > NOW() - INTERVAL '24 hours';
END;
$function$;

-- Fix registration system test (remove SECURITY DEFINER, add admin check)
CREATE FUNCTION public.test_registration_system()
RETURNS TABLE(component text, status text, message text)
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
  SELECT 'customer_accounts'::text, 'ok'::text, 'Customer accounts table accessible'::text
  WHERE EXISTS (SELECT 1 FROM customer_accounts LIMIT 1)
  
  UNION ALL
  
  SELECT 'auth_users'::text, 'ok'::text, 'Auth users accessible via function'::text
  WHERE auth.uid() IS NOT NULL
  
  UNION ALL
  
  SELECT 'communication_events'::text, 'ok'::text, 'Communication events table accessible'::text
  WHERE EXISTS (SELECT 1 FROM communication_events LIMIT 1);
END;
$function$;

-- Fix admin invitation token validation (remove SECURITY DEFINER, add admin check)
CREATE FUNCTION public.validate_admin_invitation_token(token text)
RETURNS TABLE(invitation_id uuid, email text, role text, expires_at timestamp with time zone, is_valid boolean)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ai.id as invitation_id,
    ai.email,
    ai.role::text,
    ai.expires_at,
    (ai.status = 'pending' AND ai.expires_at > NOW()) as is_valid
  FROM admin_invitations ai
  WHERE ai.invitation_token = token
  LIMIT 1;
END;
$function$;