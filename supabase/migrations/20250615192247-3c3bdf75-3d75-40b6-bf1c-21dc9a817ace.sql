
-- Enhanced get_dashboard_data function with revenue trends and order trends
CREATE OR REPLACE FUNCTION public.get_dashboard_data()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  result json;
  kpi_stats_json json;
  recent_orders_json json;
  popular_items_json json;
  revenue_trends_json json;
  order_trends_json json;
  today_start timestamptz := date_trunc('day', now() at time zone 'utc');
  week_start timestamptz := date_trunc('day', now() at time zone 'utc') - interval '6 days';
BEGIN
  -- Log function start
  RAISE NOTICE 'get_dashboard_data function started at %', now();
  
  -- KPI Stats
  SELECT
    json_build_object(
      'todaysRevenue', (SELECT COALESCE(SUM(total_amount), 0) FROM public.orders WHERE status <> 'cancelled' AND order_time >= today_start),
      'ordersToday', (SELECT COUNT(*) FROM public.orders WHERE order_time >= today_start),
      'pendingOrders', (SELECT COUNT(*) FROM public.orders WHERE status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery')),
      'completedOrders', (SELECT COUNT(*) FROM public.orders WHERE status = 'delivered' AND order_time >= today_start)
    )
  INTO kpi_stats_json;
  
  RAISE NOTICE 'KPI stats generated: %', kpi_stats_json;
  
  -- Revenue Trends (past 7 days)
  SELECT
    json_agg(
      json_build_object(
        'day', CASE 
          WHEN EXTRACT(DOW FROM day_date) = 0 THEN 'Sun'
          WHEN EXTRACT(DOW FROM day_date) = 1 THEN 'Mon' 
          WHEN EXTRACT(DOW FROM day_date) = 2 THEN 'Tue'
          WHEN EXTRACT(DOW FROM day_date) = 3 THEN 'Wed'
          WHEN EXTRACT(DOW FROM day_date) = 4 THEN 'Thu'
          WHEN EXTRACT(DOW FROM day_date) = 5 THEN 'Fri'
          WHEN EXTRACT(DOW FROM day_date) = 6 THEN 'Sat'
        END,
        'revenue', COALESCE(daily_revenue, 0)
      ) ORDER BY day_date
    )
  INTO revenue_trends_json
  FROM (
    SELECT 
      generate_series(week_start, today_start, '1 day'::interval)::date as day_date,
      (
        SELECT COALESCE(SUM(total_amount), 0)
        FROM public.orders 
        WHERE date_trunc('day', order_time) = generate_series(week_start, today_start, '1 day'::interval)::date
        AND status <> 'cancelled'
      ) as daily_revenue
  ) revenue_data;
  
  RAISE NOTICE 'Revenue trends generated: %', revenue_trends_json;
  
  -- Order Trends (past 7 days)
  SELECT
    json_agg(
      json_build_object(
        'day', CASE 
          WHEN EXTRACT(DOW FROM day_date) = 0 THEN 'Sun'
          WHEN EXTRACT(DOW FROM day_date) = 1 THEN 'Mon'
          WHEN EXTRACT(DOW FROM day_date) = 2 THEN 'Tue'
          WHEN EXTRACT(DOW FROM day_date) = 3 THEN 'Wed'
          WHEN EXTRACT(DOW FROM day_date) = 4 THEN 'Thu'
          WHEN EXTRACT(DOW FROM day_date) = 5 THEN 'Fri'
          WHEN EXTRACT(DOW FROM day_date) = 6 THEN 'Sat'
        END,
        'orders', COALESCE(daily_orders, 0)
      ) ORDER BY day_date
    )
  INTO order_trends_json
  FROM (
    SELECT 
      generate_series(week_start, today_start, '1 day'::interval)::date as day_date,
      (
        SELECT COUNT(*)
        FROM public.orders 
        WHERE date_trunc('day', order_time) = generate_series(week_start, today_start, '1 day'::interval)::date
      ) as daily_orders
  ) order_data;
  
  RAISE NOTICE 'Order trends generated: %', order_trends_json;
  
  -- Recent Orders
  SELECT
    json_agg(
      json_build_object(
        'id', o.order_number,
        'customer', o.customer_name,
        'amount', '₦' || to_char(o.total_amount, 'FM999,999,999D00'),
        'status', CASE 
          WHEN o.status = 'confirmed' THEN 'Preparing'
          WHEN o.status = 'preparing' THEN 'Preparing'
          WHEN o.status = 'ready' THEN 'Ready for Pickup'
          WHEN o.status = 'out_for_delivery' THEN 'Out for Delivery'
          WHEN o.status = 'delivered' THEN 'Delivered'
          ELSE INITCAP(o.status)
        END,
        'items', COALESCE((
          SELECT STRING_AGG(oi.quantity || 'x ' || p.name, ', ')
          FROM public.order_items oi
          JOIN public.products p ON oi.product_id = p.id
          WHERE oi.order_id = o.id
        ), 'No items')
      )
    )
  INTO recent_orders_json
  FROM (
    SELECT *
    FROM public.orders
    ORDER BY order_time DESC
    LIMIT 4
  ) o;
  
  RAISE NOTICE 'Recent orders generated: %', recent_orders_json;
  
  -- Popular Items Today
  SELECT
    json_agg(
      json_build_object(
        'name', t.name,
        'orders', t.orders,
        'revenue', '₦' || to_char(t.revenue, 'FM999,999,999D00')
      )
    )
  INTO popular_items_json
  FROM (
    SELECT
      p.name,
      SUM(oi.quantity)::bigint as orders,
      SUM(oi.quantity * oi.price) as revenue
    FROM public.order_items oi
    JOIN public.products p ON oi.product_id = p.id
    JOIN public.orders o ON oi.order_id = o.id
    WHERE o.order_time >= today_start AND o.status <> 'cancelled'
    GROUP BY p.name
    ORDER BY orders DESC
    LIMIT 4
  ) t;
  
  RAISE NOTICE 'Popular items generated: %', popular_items_json;
  
  -- Build final result
  SELECT
    json_build_object(
      'kpiStats', kpi_stats_json,
      'recentOrders', COALESCE(recent_orders_json, '[]'::json),
      'popularItems', COALESCE(popular_items_json, '[]'::json),
      'revenueTrends', COALESCE(revenue_trends_json, '[]'::json),
      'orderTrends', COALESCE(order_trends_json, '[]'::json)
    )
  INTO result;
  
  RAISE NOTICE 'Final result: %', result;
  
  RETURN result;
END;
$function$
