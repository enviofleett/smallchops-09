-- Fix remaining SECURITY DEFINER table-valued functions
-- Part 2: Remove SECURITY DEFINER from remaining functions where not essential

-- Fix customer-related functions - remove SECURITY DEFINER, use RLS
CREATE OR REPLACE FUNCTION public.find_or_create_customer(p_email text, p_name text, p_phone text DEFAULT NULL::text, p_is_guest boolean DEFAULT false)
RETURNS TABLE(customer_id uuid, is_new boolean)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_is_new boolean := false;
BEGIN
  -- Look for existing customer by email
  SELECT id INTO v_customer_id
  FROM customers
  WHERE email = LOWER(TRIM(p_email))
  LIMIT 1;
  
  IF v_customer_id IS NULL THEN
    -- Create new customer
    INSERT INTO customers (name, email, phone, created_at, updated_at)
    VALUES (p_name, LOWER(TRIM(p_email)), p_phone, NOW(), NOW())
    RETURNING id INTO v_customer_id;
    
    v_is_new := true;
  END IF;
  
  RETURN QUERY SELECT v_customer_id, v_is_new;
END;
$function$;

-- Fix payment status functions - remove SECURITY DEFINER, use admin checks
CREATE OR REPLACE FUNCTION public.get_admin_payment_status(p_order_id uuid DEFAULT NULL::uuid, p_payment_reference text DEFAULT NULL::text, p_limit integer DEFAULT 50)
RETURNS TABLE(order_id uuid, order_number text, payment_reference text, reference_type text, processing_stage text, overall_status text, error_message text, created_at timestamp with time zone, order_type text)
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
    ppl.order_id,
    o.order_number,
    ppl.payment_reference,
    ppl.reference_type,
    ppl.processing_stage,
    CASE 
      WHEN o.status = 'confirmed' AND o.payment_status = 'paid' THEN 'completed'
      WHEN ppl.error_message IS NOT NULL THEN 'error'
      WHEN o.payment_status = 'pending' THEN 'pending'
      ELSE 'unknown'
    END as overall_status,
    ppl.error_message,
    ppl.created_at,
    o.order_type::text
  FROM payment_processing_logs ppl
  JOIN orders o ON o.id = ppl.order_id
  WHERE (p_order_id IS NULL OR ppl.order_id = p_order_id)
    AND (p_payment_reference IS NULL OR ppl.payment_reference = p_payment_reference)
  ORDER BY ppl.created_at DESC
  LIMIT p_limit;
END;
$function$;

-- Fix secure payment status function - remove SECURITY DEFINER, use admin checks
CREATE OR REPLACE FUNCTION public.get_admin_payment_status_secure(p_order_id uuid DEFAULT NULL::uuid, p_payment_reference text DEFAULT NULL::text, p_overall_status text DEFAULT NULL::text, p_limit integer DEFAULT 50)
RETURNS TABLE(order_id uuid, order_number text, payment_reference text, reference_type text, processing_stage text, overall_status text, current_order_status text, error_message text, created_at timestamp with time zone, updated_at timestamp with time zone, order_type text)
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
    ppl.order_id,
    o.order_number,
    ppl.payment_reference,
    ppl.reference_type,
    ppl.processing_stage,
    CASE 
      WHEN o.status = 'confirmed' AND o.payment_status = 'paid' THEN 'completed'
      WHEN ppl.error_message IS NOT NULL THEN 'error'
      WHEN o.payment_status = 'pending' THEN 'pending'
      ELSE 'unknown'
    END as overall_status,
    o.status::text as current_order_status,
    ppl.error_message,
    ppl.created_at,
    o.updated_at,
    o.order_type::text
  FROM payment_processing_logs ppl
  JOIN orders o ON o.id = ppl.order_id
  WHERE (p_order_id IS NULL OR ppl.order_id = p_order_id)
    AND (p_payment_reference IS NULL OR ppl.payment_reference = p_payment_reference)
    AND (p_overall_status IS NULL OR 
         CASE 
           WHEN o.status = 'confirmed' AND o.payment_status = 'paid' THEN 'completed'
           WHEN ppl.error_message IS NOT NULL THEN 'error'
           WHEN o.payment_status = 'pending' THEN 'pending'
           ELSE 'unknown'
         END = p_overall_status)
  ORDER BY ppl.created_at DESC
  LIMIT p_limit;
END;
$function$;

-- Fix analytics function - remove SECURITY DEFINER, use admin checks
CREATE OR REPLACE FUNCTION public.get_all_customers_for_analytics()
RETURNS TABLE(customer_id uuid, customer_name text, customer_email text, customer_phone text, is_registered boolean, registration_date timestamp with time zone)
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
    c.id as customer_id,
    c.name as customer_name,
    c.email as customer_email,
    c.phone as customer_phone,
    (c.user_id IS NOT NULL) as is_registered,
    c.created_at as registration_date
  FROM customers c
  ORDER BY c.created_at DESC;
END;
$function$;

-- Fix delivery slots function - remove SECURITY DEFINER (public data)
CREATE OR REPLACE FUNCTION public.get_available_delivery_slots()
RETURNS TABLE(slot_id uuid, date date, start_time time without time zone, end_time time without time zone, max_capacity integer, current_bookings integer, available_spots integer, is_available boolean)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    dts.id as slot_id,
    dts.date,
    dts.start_time,
    dts.end_time,
    dts.max_capacity,
    COALESCE(COUNT(o.id)::integer, 0) as current_bookings,
    (dts.max_capacity - COALESCE(COUNT(o.id)::integer, 0)) as available_spots,
    (dts.max_capacity > COALESCE(COUNT(o.id)::integer, 0) AND dts.is_active = true) as is_available
  FROM delivery_time_slots dts
  LEFT JOIN orders o ON o.delivery_time_slot_id = dts.id AND o.status != 'cancelled'
  WHERE dts.date >= CURRENT_DATE
    AND dts.is_active = true
  GROUP BY dts.id, dts.date, dts.start_time, dts.end_time, dts.max_capacity, dts.is_active
  ORDER BY dts.date, dts.start_time;
END;
$function$;

-- Fix dashboard function - remove SECURITY DEFINER, use admin checks
CREATE OR REPLACE FUNCTION public.get_dashboard_data()
RETURNS TABLE(total_products bigint, total_orders bigint, total_customers bigint, total_revenue numeric)
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
    (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE payment_status = 'paid') as total_revenue;
END;
$function$;