-- Drop all versions of get_customer_analytics_safe
DROP FUNCTION IF EXISTS get_customer_analytics_safe(timestamp with time zone, timestamp with time zone) CASCADE;

-- Drop all versions of get_all_customers_display
DROP FUNCTION IF EXISTS get_all_customers_display() CASCADE;
DROP FUNCTION IF EXISTS get_all_customers_display(timestamp with time zone, timestamp with time zone) CASCADE;

-- Create get_customer_analytics_safe with proper date filtering
CREATE OR REPLACE FUNCTION get_customer_analytics_safe(
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics jsonb;
  v_total_customers bigint := 0;
  v_active_customers bigint := 0;
  v_guest_customers bigint := 0;
  v_authenticated_customers bigint := 0;
  v_total_revenue numeric := 0;
  v_total_orders bigint := 0;
  v_repeat_customers bigint := 0;
  v_avg_order_value numeric := 0;
  v_repeat_rate numeric := 0;
BEGIN
  -- CRITICAL FIX: Only count customers who have orders in the date range
  SELECT COUNT(DISTINCT customer_email) INTO v_total_customers
  FROM orders
  WHERE created_at >= p_start_date 
    AND created_at <= p_end_date
    AND payment_status IN ('paid', 'completed')
    AND customer_email IS NOT NULL
    AND customer_email != '';

  v_active_customers := v_total_customers;

  -- Guest customers in date range
  SELECT COUNT(DISTINCT customer_email) INTO v_guest_customers
  FROM orders
  WHERE created_at >= p_start_date 
    AND created_at <= p_end_date
    AND payment_status IN ('paid', 'completed')
    AND customer_id IS NULL
    AND customer_email IS NOT NULL
    AND customer_email != '';

  -- Authenticated customers in date range
  SELECT COUNT(DISTINCT customer_email) INTO v_authenticated_customers
  FROM orders
  WHERE created_at >= p_start_date 
    AND created_at <= p_end_date
    AND payment_status IN ('paid', 'completed')
    AND customer_id IS NOT NULL
    AND customer_email IS NOT NULL
    AND customer_email != '';

  -- Total revenue and orders
  SELECT 
    COALESCE(SUM(total_amount), 0),
    COUNT(*)
  INTO v_total_revenue, v_total_orders
  FROM orders
  WHERE created_at >= p_start_date 
    AND created_at <= p_end_date
    AND payment_status IN ('paid', 'completed');

  -- Repeat customers
  SELECT COUNT(*) INTO v_repeat_customers
  FROM (
    SELECT customer_email
    FROM orders
    WHERE created_at >= p_start_date 
      AND created_at <= p_end_date
      AND payment_status IN ('paid', 'completed')
      AND customer_email IS NOT NULL
      AND customer_email != ''
    GROUP BY customer_email
    HAVING COUNT(*) > 1
  ) repeat_custs;

  -- Calculate averages
  IF v_total_orders > 0 THEN
    v_avg_order_value := v_total_revenue / v_total_orders;
  END IF;

  IF v_total_customers > 0 THEN
    v_repeat_rate := (v_repeat_customers::numeric / v_total_customers::numeric) * 100;
  END IF;

  v_metrics := jsonb_build_object(
    'totalCustomers', COALESCE(v_total_customers, 0),
    'activeCustomers', COALESCE(v_active_customers, 0),
    'guestCustomers', COALESCE(v_guest_customers, 0),
    'authenticatedCustomers', COALESCE(v_authenticated_customers, 0),
    'avgOrderValue', ROUND(COALESCE(v_avg_order_value, 0), 2),
    'repeatCustomerRate', ROUND(COALESCE(v_repeat_rate, 0), 2),
    'totalRevenue', ROUND(COALESCE(v_total_revenue, 0), 2),
    'totalOrders', COALESCE(v_total_orders, 0),
    'repeatCustomers', COALESCE(v_repeat_customers, 0)
  );

  RETURN jsonb_build_object('metrics', v_metrics);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'metrics', jsonb_build_object(
      'totalCustomers', 0,
      'activeCustomers', 0,
      'guestCustomers', 0,
      'authenticatedCustomers', 0,
      'avgOrderValue', 0,
      'repeatCustomerRate', 0,
      'totalRevenue', 0,
      'totalOrders', 0,
      'repeatCustomers', 0
    ),
    'error', SQLERRM
  );
END;
$$;

-- Create get_all_customers_display with date filtering
CREATE OR REPLACE FUNCTION get_all_customers_display(
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  id text,
  name text,
  email text,
  phone text,
  "totalOrders" bigint,
  "totalSpent" numeric,
  status text,
  "lastOrderDate" text,
  "isGuest" boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH date_filtered_orders AS (
    SELECT *
    FROM orders
    WHERE payment_status IN ('paid', 'completed')
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
  ),
  authenticated_customers AS (
    SELECT 
      c.id::text as id,
      c.name,
      c.email,
      c.phone,
      COUNT(o.id) as total_orders,
      COALESCE(SUM(o.total_amount), 0) as total_spent,
      MAX(o.created_at) as last_order_date,
      false as is_guest
    FROM customers c
    LEFT JOIN date_filtered_orders o ON o.customer_id = c.id
    WHERE (p_start_date IS NULL AND p_end_date IS NULL) 
       OR EXISTS (
         SELECT 1 FROM date_filtered_orders dfo 
         WHERE dfo.customer_id = c.id
       )
    GROUP BY c.id, c.name, c.email, c.phone
  ),
  guest_customers AS (
    SELECT 
      'guest-' || md5(o.customer_email)::text as id,
      o.customer_name as name,
      o.customer_email as email,
      o.customer_phone as phone,
      COUNT(o.id) as total_orders,
      COALESCE(SUM(o.total_amount), 0) as total_spent,
      MAX(o.created_at) as last_order_date,
      true as is_guest
    FROM date_filtered_orders o
    WHERE o.customer_id IS NULL
      AND o.customer_email IS NOT NULL
      AND o.customer_email != ''
    GROUP BY o.customer_email, o.customer_name, o.customer_phone
  ),
  all_customers AS (
    SELECT * FROM authenticated_customers
    UNION ALL
    SELECT * FROM guest_customers
  )
  SELECT 
    ac.id,
    ac.name,
    ac.email,
    ac.phone,
    ac.total_orders as "totalOrders",
    ROUND(ac.total_spent, 2) as "totalSpent",
    CASE 
      WHEN ac.total_spent >= 5000 THEN 'VIP'
      WHEN ac.total_orders > 0 THEN 'Active'
      WHEN ac.is_guest THEN 'Registered'
      ELSE 'Inactive'
    END as status,
    TO_CHAR(ac.last_order_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "lastOrderDate",
    ac.is_guest as "isGuest"
  FROM all_customers ac
  WHERE ac.total_orders > 0
  ORDER BY ac.total_spent DESC, ac.total_orders DESC;
END;
$$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_date_payment_customer 
ON orders(created_at, payment_status, customer_email) 
WHERE payment_status IN ('paid', 'completed');

CREATE INDEX IF NOT EXISTS idx_orders_customer_id_date 
ON orders(customer_id, created_at, payment_status) 
WHERE payment_status IN ('paid', 'completed');