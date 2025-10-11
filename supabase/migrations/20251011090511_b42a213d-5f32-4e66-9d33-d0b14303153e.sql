-- ============================================================================
-- CRITICAL PRODUCTION FIX: Update payment status filtering across all RPC functions
-- Issue: October 2025 orders use 'completed' status but queries only check 'paid'
-- Impact: ₦41,993,995 revenue from 876 October orders not showing in reports
-- ============================================================================

-- 1. Update get_daily_revenue_report to include both 'paid' and 'completed'
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
    AND o.payment_status IN ('paid', 'completed')  -- ✅ FIXED: Include both statuses
  GROUP BY o.created_at::DATE
  ORDER BY o.created_at::DATE DESC;
END;
$function$;

-- 2. Update get_products_sold_report to include both 'paid' and 'completed'
CREATE OR REPLACE FUNCTION public.get_products_sold_report(p_start_date date, p_end_date date, p_interval text DEFAULT 'day'::text)
 RETURNS TABLE(interval_start timestamp with time zone, product_id uuid, product_name text, units_sold bigint, total_revenue numeric, avg_price numeric)
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
    AND o.payment_status IN ('paid', 'completed')  -- ✅ FIXED: Include both statuses
  GROUP BY DATE_TRUNC(p_interval, o.created_at), oi.product_id, p.name, oi.product_name
  ORDER BY interval_start DESC, units_sold DESC;
END;
$function$;

-- 3. Update get_top_selling_products to include both 'paid' and 'completed'
CREATE OR REPLACE FUNCTION public.get_top_selling_products(p_start_date date, p_end_date date, p_limit integer DEFAULT 10)
 RETURNS TABLE(product_id uuid, product_name text, total_units_sold bigint, total_revenue numeric, number_of_orders bigint, avg_order_quantity numeric)
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
    AND o.payment_status IN ('paid', 'completed')  -- ✅ FIXED: Include both statuses
  GROUP BY oi.product_id, p.name, oi.product_name
  ORDER BY total_units_sold DESC
  LIMIT p_limit;
END;
$function$;

-- 4. Update get_driver_revenue_report to include both 'paid' and 'completed'
CREATE OR REPLACE FUNCTION public.get_driver_revenue_report(p_start_date date, p_end_date date, p_interval text DEFAULT 'day'::text)
 RETURNS TABLE(interval_start timestamp with time zone, driver_id uuid, driver_name text, total_deliveries bigint, total_revenue numeric, total_delivery_fees numeric, avg_delivery_fee numeric)
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
    AND o.payment_status IN ('paid', 'completed')  -- ✅ FIXED: Include both statuses
    AND o.order_type = 'delivery'
    AND o.status IN ('delivered', 'completed')
  GROUP BY DATE_TRUNC(p_interval, o.created_at), o.assigned_rider_id, d.name
  ORDER BY interval_start DESC, total_deliveries DESC;
END;
$function$;

-- 5. Add comment documenting the payment status enum values
COMMENT ON TYPE payment_status IS 'Payment status enum - both ''paid'' (legacy) and ''completed'' (current) represent successful payments and should be treated equally in revenue calculations';

-- Log the migration
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'payment_status_filtering_fixed',
  'Database Migration',
  'Updated all RPC functions to filter by both ''paid'' and ''completed'' payment statuses',
  jsonb_build_object(
    'affected_functions', ARRAY['get_daily_revenue_report', 'get_products_sold_report', 'get_top_selling_products', 'get_driver_revenue_report'],
    'issue', 'October 2025 orders using completed status were excluded from reports',
    'estimated_missing_revenue', 41993995,
    'estimated_missing_orders', 876,
    'migration_date', now()
  )
);