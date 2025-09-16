-- Update customer analytics functions to only count paid orders
-- This ensures the "Repeat Business Champions" section only shows customers who actually paid

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_customer_analytics_safe(timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS get_all_customers_display();

-- Create improved analytics function that only counts paid orders
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
  v_total_customers integer := 0;
  v_active_customers integer := 0;
  v_avg_order_value numeric := 0;
  v_repeat_customer_rate numeric := 0;
  v_guest_customers integer := 0;
  v_authenticated_customers integer := 0;
BEGIN
  -- Count total unique customers (from both customer_accounts and orders)
  SELECT COUNT(DISTINCT email) INTO v_total_customers
  FROM (
    SELECT email FROM customer_accounts WHERE email IS NOT NULL
    UNION
    SELECT customer_email as email FROM orders WHERE customer_email IS NOT NULL AND payment_status = 'paid'
  ) all_emails;

  -- Count active customers (those with paid orders in the period)
  SELECT COUNT(DISTINCT customer_email) INTO v_active_customers
  FROM orders 
  WHERE created_at >= p_start_date 
    AND created_at <= p_end_date
    AND payment_status = 'paid'
    AND customer_email IS NOT NULL;

  -- Calculate average order value (only paid orders)
  SELECT COALESCE(AVG(total_amount), 0) INTO v_avg_order_value
  FROM orders 
  WHERE created_at >= p_start_date 
    AND created_at <= p_end_date
    AND payment_status = 'paid';

  -- Count guest vs authenticated customers (only with paid orders)
  SELECT 
    COUNT(DISTINCT CASE WHEN ca.id IS NULL THEN o.customer_email END) as guest_count,
    COUNT(DISTINCT CASE WHEN ca.id IS NOT NULL THEN o.customer_email END) as auth_count
  INTO v_guest_customers, v_authenticated_customers
  FROM orders o
  LEFT JOIN customer_accounts ca ON ca.email = o.customer_email
  WHERE o.created_at >= p_start_date 
    AND o.created_at <= p_end_date
    AND o.payment_status = 'paid'
    AND o.customer_email IS NOT NULL;

  -- Calculate repeat customer rate (customers with more than 1 paid order)
  WITH customer_order_counts AS (
    SELECT customer_email, COUNT(*) as order_count
    FROM orders 
    WHERE payment_status = 'paid' AND customer_email IS NOT NULL
    GROUP BY customer_email
  )
  SELECT 
    CASE WHEN v_active_customers > 0 
    THEN ROUND((COUNT(CASE WHEN order_count > 1 THEN 1 END)::numeric / v_active_customers * 100), 2)
    ELSE 0 
    END
  INTO v_repeat_customer_rate
  FROM customer_order_counts;

  -- Build metrics object
  v_metrics := jsonb_build_object(
    'totalCustomers', v_total_customers,
    'activeCustomers', v_active_customers,
    'avgOrderValue', ROUND(v_avg_order_value, 2),
    'repeatCustomerRate', v_repeat_customer_rate,
    'guestCustomers', v_guest_customers,
    'authenticatedCustomers', v_authenticated_customers
  );

  RETURN jsonb_build_object('metrics', v_metrics);

EXCEPTION WHEN OTHERS THEN
  -- Return safe fallback data on error
  RETURN jsonb_build_object(
    'metrics', jsonb_build_object(
      'totalCustomers', 0,
      'activeCustomers', 0,
      'avgOrderValue', 0,
      'repeatCustomerRate', 0,
      'guestCustomers', 0,
      'authenticatedCustomers', 0
    )
  );
END;
$$;

-- Create function to get all customers with paid order data only
CREATE OR REPLACE FUNCTION get_all_customers_display()
RETURNS TABLE(
  id text,
  name text,
  email text,
  phone text,
  "totalOrders" integer,
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
  SELECT 
    COALESCE(ca.id::text, 'guest-' || encode(sha256(o.customer_email::bytea), 'hex')::text) as id,
    COALESCE(ca.name, o.customer_name) as name,
    COALESCE(ca.email, o.customer_email) as email,
    COALESCE(ca.phone, o.customer_phone) as phone,
    COUNT(o.id)::integer as "totalOrders",
    COALESCE(SUM(o.total_amount), 0)::numeric as "totalSpent",
    CASE 
      WHEN COALESCE(SUM(o.total_amount), 0) >= 50000 THEN 'VIP'
      WHEN COUNT(o.id) >= 3 THEN 'Active'
      WHEN COUNT(o.id) >= 1 THEN 'Registered'
      ELSE 'Inactive'
    END as status,
    COALESCE(MAX(o.created_at)::text, '') as "lastOrderDate",
    (ca.id IS NULL) as "isGuest"
  FROM orders o
  LEFT JOIN customer_accounts ca ON ca.email = o.customer_email
  WHERE o.payment_status = 'paid'  -- Only count paid orders
    AND o.customer_email IS NOT NULL
  GROUP BY 
    ca.id, 
    ca.name, 
    ca.email, 
    ca.phone, 
    o.customer_name, 
    o.customer_email, 
    o.customer_phone
  
  UNION ALL
  
  -- Include customers who registered but never made a paid order
  SELECT 
    ca.id::text as id,
    ca.name as name,
    ca.email as email,
    ca.phone as phone,
    0::integer as "totalOrders",
    0::numeric as "totalSpent",
    'Inactive' as status,
    '' as "lastOrderDate",
    false as "isGuest"
  FROM customer_accounts ca
  WHERE NOT EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.customer_email = ca.email 
    AND o.payment_status = 'paid'
  )
  
  ORDER BY "totalSpent" DESC, "totalOrders" DESC;

EXCEPTION WHEN OTHERS THEN
  -- Return empty result on error to prevent crashes
  RETURN;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_customer_analytics_safe(timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_customers_display() TO authenticated;