-- ============================================================================
-- CRITICAL REVENUE CALCULATION FIX - PRODUCTION READY
-- ============================================================================
-- This migration updates all database RPC functions to only count PAID orders
-- as revenue. Previously, functions were including pending/unpaid orders which
-- resulted in inflated revenue numbers.
-- ============================================================================

-- 1. Fix get_daily_revenue_report
CREATE OR REPLACE FUNCTION public.get_daily_revenue_report(p_start_date date, p_end_date date)
RETURNS TABLE(date date, total_revenue numeric, total_orders bigint, avg_order_value numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    o.created_at::DATE as date,
    COALESCE(SUM(o.total_amount), 0) as total_revenue,
    COUNT(o.id) as total_orders,
    COALESCE(AVG(o.total_amount), 0) as avg_order_value
  FROM orders o
  WHERE o.created_at::DATE >= p_start_date
    AND o.created_at::DATE <= p_end_date
    AND o.payment_status = 'paid'
  GROUP BY o.created_at::DATE
  ORDER BY o.created_at::DATE DESC;
END;
$function$;

-- 2. Fix get_driver_revenue_report
CREATE OR REPLACE FUNCTION public.get_driver_revenue_report(
  p_start_date date, 
  p_end_date date, 
  p_interval text DEFAULT 'day'::text
)
RETURNS TABLE(
  interval_start timestamp with time zone, 
  driver_id uuid, 
  driver_name text, 
  total_deliveries bigint, 
  total_revenue numeric, 
  total_delivery_fees numeric, 
  avg_delivery_fee numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC(p_interval, o.created_at) as interval_start,
    o.assigned_rider_id as driver_id,
    COALESCE(d.name, 'Unassigned') as driver_name,
    COUNT(o.id) as total_deliveries,
    SUM(o.total_amount) as total_revenue,
    SUM(COALESCE(o.delivery_fee, 0)) as total_delivery_fees,
    AVG(COALESCE(o.delivery_fee, 0)) as avg_delivery_fee
  FROM orders o
  LEFT JOIN drivers d ON o.assigned_rider_id = d.id
  WHERE o.created_at::DATE >= p_start_date
    AND o.created_at::DATE <= p_end_date
    AND o.payment_status = 'paid'
    AND o.order_type = 'delivery'
    AND o.status IN ('delivered', 'completed')
  GROUP BY DATE_TRUNC(p_interval, o.created_at), o.assigned_rider_id, d.name
  ORDER BY interval_start DESC, total_deliveries DESC;
END;
$function$;

-- 3. Fix get_products_sold_report
CREATE OR REPLACE FUNCTION public.get_products_sold_report(
  p_start_date date, 
  p_end_date date, 
  p_interval text DEFAULT 'day'::text
)
RETURNS TABLE(
  interval_start timestamp with time zone, 
  product_id uuid, 
  product_name text, 
  units_sold bigint, 
  total_revenue numeric, 
  avg_price numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC(p_interval, o.created_at) as interval_start,
    oi.product_id,
    COALESCE(p.name, oi.product_name, 'Unknown Product') as product_name,
    SUM(oi.quantity) as units_sold,
    SUM(oi.total_price) as total_revenue,
    AVG(oi.unit_price) as avg_price
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  LEFT JOIN products p ON oi.product_id = p.id
  WHERE o.created_at::DATE >= p_start_date
    AND o.created_at::DATE <= p_end_date
    AND o.payment_status = 'paid'
  GROUP BY DATE_TRUNC(p_interval, o.created_at), oi.product_id, p.name, oi.product_name
  ORDER BY interval_start DESC, units_sold DESC;
END;
$function$;

-- 4. Fix get_top_selling_products
CREATE OR REPLACE FUNCTION public.get_top_selling_products(
  p_start_date date, 
  p_end_date date, 
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  product_id uuid, 
  product_name text, 
  total_units_sold bigint, 
  total_revenue numeric, 
  number_of_orders bigint, 
  avg_order_quantity numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    oi.product_id,
    COALESCE(p.name, oi.product_name, 'Unknown Product') as product_name,
    SUM(oi.quantity) as total_units_sold,
    SUM(oi.total_price) as total_revenue,
    COUNT(DISTINCT o.id) as number_of_orders,
    AVG(oi.quantity) as avg_order_quantity
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  LEFT JOIN products p ON oi.product_id = p.id
  WHERE o.created_at::DATE >= p_start_date
    AND o.created_at::DATE <= p_end_date
    AND o.payment_status = 'paid'
  GROUP BY oi.product_id, p.name, oi.product_name
  ORDER BY total_units_sold DESC
  LIMIT p_limit;
END;
$function$;

-- 5. Fix get_product_sales_trends
CREATE OR REPLACE FUNCTION public.get_product_sales_trends(
  p_product_id uuid, 
  p_start_date date, 
  p_end_date date, 
  p_interval text DEFAULT 'day'::text
)
RETURNS TABLE(
  interval_start timestamp with time zone, 
  units_sold bigint, 
  revenue numeric, 
  orders_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC(p_interval, o.created_at) as interval_start,
    SUM(oi.quantity) as units_sold,
    SUM(oi.total_price) as revenue,
    COUNT(DISTINCT o.id) as orders_count
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  WHERE oi.product_id = p_product_id
    AND o.created_at::DATE >= p_start_date
    AND o.created_at::DATE <= p_end_date
    AND o.payment_status = 'paid'
  GROUP BY DATE_TRUNC(p_interval, o.created_at)
  ORDER BY interval_start ASC;
END;
$function$;

-- 6. Add audit log entry for this critical fix
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'revenue_calculation_fix',
  'System',
  'Fixed all revenue calculation functions to only include PAID orders',
  jsonb_build_object(
    'functions_updated', ARRAY[
      'get_daily_revenue_report',
      'get_driver_revenue_report',
      'get_products_sold_report',
      'get_top_selling_products',
      'get_product_sales_trends'
    ],
    'fix_description', 'Added payment_status = paid filter to all revenue queries',
    'production_ready', true,
    'timestamp', now()
  )
);