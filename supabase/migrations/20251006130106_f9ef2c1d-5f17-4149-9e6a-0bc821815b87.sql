-- ============================================
-- ADVANCED REPORTS & ANALYTICS SYSTEM
-- Complete redesign with comprehensive business intelligence
-- ============================================

-- 1. Daily Revenue Report Function
CREATE OR REPLACE FUNCTION get_daily_revenue_report(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  date DATE,
  total_revenue NUMERIC,
  total_orders BIGINT,
  avg_order_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND o.payment_status IN ('paid', 'completed')
  GROUP BY o.created_at::DATE
  ORDER BY o.created_at::DATE DESC;
END;
$$;

-- 2. Products Sold Report Function (with intervals)
CREATE OR REPLACE FUNCTION get_products_sold_report(
  p_start_date DATE,
  p_end_date DATE,
  p_interval TEXT DEFAULT 'day' -- 'day', 'week', 'month'
)
RETURNS TABLE (
  interval_start TIMESTAMP WITH TIME ZONE,
  product_id UUID,
  product_name TEXT,
  units_sold BIGINT,
  total_revenue NUMERIC,
  avg_price NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND o.payment_status IN ('paid', 'completed')
  GROUP BY DATE_TRUNC(p_interval, o.created_at), oi.product_id, p.name, oi.product_name
  ORDER BY interval_start DESC, units_sold DESC;
END;
$$;

-- 3. Top Selling Products Function
CREATE OR REPLACE FUNCTION get_top_selling_products(
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  total_units_sold BIGINT,
  total_revenue NUMERIC,
  number_of_orders BIGINT,
  avg_order_quantity NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND o.payment_status IN ('paid', 'completed')
  GROUP BY oi.product_id, p.name, oi.product_name
  ORDER BY total_units_sold DESC
  LIMIT p_limit;
END;
$$;

-- 4. Product Sales Trends Function
CREATE OR REPLACE FUNCTION get_product_sales_trends(
  p_product_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_interval TEXT DEFAULT 'day'
)
RETURNS TABLE (
  interval_start TIMESTAMP WITH TIME ZONE,
  units_sold BIGINT,
  revenue NUMERIC,
  orders_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND o.payment_status IN ('paid', 'completed')
  GROUP BY DATE_TRUNC(p_interval, o.created_at)
  ORDER BY interval_start ASC;
END;
$$;

-- 5. Driver Revenue Report Function
CREATE OR REPLACE FUNCTION get_driver_revenue_report(
  p_start_date DATE,
  p_end_date DATE,
  p_interval TEXT DEFAULT 'day'
)
RETURNS TABLE (
  interval_start TIMESTAMP WITH TIME ZONE,
  driver_id UUID,
  driver_name TEXT,
  total_deliveries BIGINT,
  total_revenue NUMERIC,
  total_delivery_fees NUMERIC,
  avg_delivery_fee NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND o.payment_status IN ('paid', 'completed')
    AND o.order_type = 'delivery'
    AND o.status IN ('delivered', 'completed')
  GROUP BY DATE_TRUNC(p_interval, o.created_at), o.assigned_rider_id, d.name
  ORDER BY interval_start DESC, total_deliveries DESC;
END;
$$;

-- 6. Driver Orders Detail Function
CREATE OR REPLACE FUNCTION get_driver_orders_detail(
  p_driver_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  order_date TIMESTAMP WITH TIME ZONE,
  customer_name TEXT,
  delivery_address JSONB,
  delivery_fee NUMERIC,
  total_amount NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id as order_id,
    o.order_number,
    o.created_at as order_date,
    o.customer_name,
    o.delivery_address,
    COALESCE(o.delivery_fee, 0) as delivery_fee,
    o.total_amount,
    o.status::TEXT
  FROM orders o
  WHERE o.assigned_rider_id = p_driver_id
    AND o.created_at::DATE >= p_start_date
    AND o.created_at::DATE <= p_end_date
    AND o.payment_status IN ('paid', 'completed')
    AND o.order_type = 'delivery'
  ORDER BY o.created_at DESC;
END;
$$;

-- 7. Comprehensive Analytics Dashboard Function
CREATE OR REPLACE FUNCTION get_analytics_dashboard(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_total_revenue NUMERIC;
  v_total_orders BIGINT;
  v_total_products BIGINT;
  v_total_customers BIGINT;
  v_avg_order_value NUMERIC;
  v_top_products JSONB;
  v_revenue_trend JSONB;
BEGIN
  -- Calculate summary metrics
  SELECT
    COALESCE(SUM(total_amount), 0),
    COUNT(*),
    COALESCE(AVG(total_amount), 0)
  INTO v_total_revenue, v_total_orders, v_avg_order_value
  FROM orders
  WHERE created_at::DATE >= p_start_date
    AND created_at::DATE <= p_end_date
    AND payment_status IN ('paid', 'completed');

  -- Get unique product count
  SELECT COUNT(DISTINCT product_id)
  INTO v_total_products
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE o.created_at::DATE >= p_start_date
    AND o.created_at::DATE <= p_end_date
    AND o.payment_status IN ('paid', 'completed');

  -- Get unique customer count
  SELECT COUNT(DISTINCT COALESCE(customer_id, customer_email))
  INTO v_total_customers
  FROM orders
  WHERE created_at::DATE >= p_start_date
    AND created_at::DATE <= p_end_date
    AND payment_status IN ('paid', 'completed');

  -- Get top 5 products
  SELECT jsonb_agg(row_to_json(t))
  INTO v_top_products
  FROM (
    SELECT * FROM get_top_selling_products(p_start_date, p_end_date, 5)
  ) t;

  -- Get daily revenue trend
  SELECT jsonb_agg(row_to_json(t))
  INTO v_revenue_trend
  FROM (
    SELECT * FROM get_daily_revenue_report(p_start_date, p_end_date)
    ORDER BY date ASC
  ) t;

  -- Build result
  v_result := jsonb_build_object(
    'summary', jsonb_build_object(
      'totalRevenue', v_total_revenue,
      'totalOrders', v_total_orders,
      'totalProducts', v_total_products,
      'totalCustomers', v_total_customers,
      'avgOrderValue', v_avg_order_value
    ),
    'topProducts', COALESCE(v_top_products, '[]'::jsonb),
    'revenueTrend', COALESCE(v_revenue_trend, '[]'::jsonb),
    'dateRange', jsonb_build_object(
      'startDate', p_start_date,
      'endDate', p_end_date
    )
  );

  RETURN v_result;
END;
$$;

-- Grant execute permissions to authenticated users (admins only via RLS)
GRANT EXECUTE ON FUNCTION get_daily_revenue_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_products_sold_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_selling_products TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_sales_trends TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_revenue_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_orders_detail TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_dashboard TO authenticated;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_created_payment_status 
  ON orders(created_at, payment_status) WHERE payment_status IN ('paid', 'completed');

CREATE INDEX IF NOT EXISTS idx_order_items_product_id 
  ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_orders_assigned_rider_delivery 
  ON orders(assigned_rider_id, created_at) 
  WHERE order_type = 'delivery' AND status IN ('delivered', 'completed');