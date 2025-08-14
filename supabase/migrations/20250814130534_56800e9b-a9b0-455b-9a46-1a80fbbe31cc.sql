-- Create delivery analytics tables for comprehensive reporting
CREATE TABLE IF NOT EXISTS delivery_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_deliveries INTEGER DEFAULT 0,
  completed_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,
  total_delivery_fees NUMERIC DEFAULT 0,
  average_delivery_time_minutes INTEGER DEFAULT 0,
  total_distance_km NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create driver performance analytics table
CREATE TABLE IF NOT EXISTS driver_delivery_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  deliveries_completed INTEGER DEFAULT 0,
  deliveries_failed INTEGER DEFAULT 0,
  total_delivery_time_minutes INTEGER DEFAULT 0,
  total_distance_km NUMERIC DEFAULT 0,
  average_customer_rating NUMERIC DEFAULT 0,
  delivery_fees_collected NUMERIC DEFAULT 0,
  fuel_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(driver_id, date)
);

-- Create zone delivery analytics table
CREATE TABLE IF NOT EXISTS zone_delivery_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES delivery_zones(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_deliveries INTEGER DEFAULT 0,
  successful_deliveries INTEGER DEFAULT 0,
  average_delivery_time_minutes INTEGER DEFAULT 0,
  total_delivery_fees NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(zone_id, date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_analytics_date ON delivery_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_analytics_date_driver ON driver_delivery_analytics(date DESC, driver_id);
CREATE INDEX IF NOT EXISTS idx_zone_analytics_date_zone ON zone_delivery_analytics(date DESC, zone_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_date ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_ready ON orders(status, order_type) WHERE status = 'ready' AND order_type = 'delivery';

-- Function to calculate daily delivery analytics
CREATE OR REPLACE FUNCTION calculate_daily_delivery_analytics(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  analytics_record RECORD;
BEGIN
  -- Calculate overall delivery analytics
  SELECT 
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status IN ('delivered', 'completed')) as completed_deliveries,
    COUNT(*) FILTER (WHERE status = 'cancelled') as failed_deliveries,
    COALESCE(SUM(delivery_fee), 0) as total_delivery_fees,
    COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60), 0)::INTEGER as avg_time_minutes,
    0 as total_distance_km -- Will be calculated from route data when available
  INTO analytics_record
  FROM orders o
  LEFT JOIN order_delivery_schedule ods ON o.id = ods.order_id
  WHERE o.order_type = 'delivery'
    AND DATE(COALESCE(ods.delivery_date::date, o.created_at::date)) = target_date;

  -- Insert or update daily analytics
  INSERT INTO delivery_analytics (
    date, 
    total_deliveries, 
    completed_deliveries,
    failed_deliveries,
    total_delivery_fees,
    average_delivery_time_minutes,
    total_distance_km,
    updated_at
  ) VALUES (
    target_date,
    analytics_record.total_deliveries,
    analytics_record.completed_deliveries,
    analytics_record.failed_deliveries,
    analytics_record.total_delivery_fees,
    analytics_record.avg_time_minutes,
    analytics_record.total_distance_km,
    NOW()
  )
  ON CONFLICT (date) 
  DO UPDATE SET
    total_deliveries = EXCLUDED.total_deliveries,
    completed_deliveries = EXCLUDED.completed_deliveries,
    failed_deliveries = EXCLUDED.failed_deliveries,
    total_delivery_fees = EXCLUDED.total_delivery_fees,
    average_delivery_time_minutes = EXCLUDED.average_delivery_time_minutes,
    total_distance_km = EXCLUDED.total_distance_km,
    updated_at = NOW();

  -- Calculate driver-specific analytics
  INSERT INTO driver_delivery_analytics (
    driver_id,
    date,
    deliveries_completed,
    deliveries_failed,
    total_delivery_time_minutes,
    delivery_fees_collected,
    updated_at
  )
  SELECT 
    o.assigned_rider_id,
    target_date,
    COUNT(*) FILTER (WHERE o.status IN ('delivered', 'completed')),
    COUNT(*) FILTER (WHERE o.status = 'cancelled'),
    COALESCE(SUM(EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60), 0)::INTEGER,
    COALESCE(SUM(o.delivery_fee), 0),
    NOW()
  FROM orders o
  LEFT JOIN order_delivery_schedule ods ON o.id = ods.order_id
  WHERE o.order_type = 'delivery'
    AND o.assigned_rider_id IS NOT NULL
    AND DATE(COALESCE(ods.delivery_date::date, o.created_at::date)) = target_date
  GROUP BY o.assigned_rider_id
  ON CONFLICT (driver_id, date)
  DO UPDATE SET
    deliveries_completed = EXCLUDED.deliveries_completed,
    deliveries_failed = EXCLUDED.deliveries_failed,
    total_delivery_time_minutes = EXCLUDED.total_delivery_time_minutes,
    delivery_fees_collected = EXCLUDED.delivery_fees_collected,
    updated_at = NOW();

  -- Calculate zone-specific analytics
  INSERT INTO zone_delivery_analytics (
    zone_id,
    date,
    total_deliveries,
    successful_deliveries,
    total_delivery_fees,
    updated_at
  )
  SELECT 
    o.delivery_zone_id,
    target_date,
    COUNT(*),
    COUNT(*) FILTER (WHERE o.status IN ('delivered', 'completed')),
    COALESCE(SUM(o.delivery_fee), 0),
    NOW()
  FROM orders o
  LEFT JOIN order_delivery_schedule ods ON o.id = ods.order_id
  WHERE o.order_type = 'delivery'
    AND o.delivery_zone_id IS NOT NULL
    AND DATE(COALESCE(ods.delivery_date::date, o.created_at::date)) = target_date
  GROUP BY o.delivery_zone_id
  ON CONFLICT (zone_id, date)
  DO UPDATE SET
    total_deliveries = EXCLUDED.total_deliveries,
    successful_deliveries = EXCLUDED.successful_deliveries,
    total_delivery_fees = EXCLUDED.total_delivery_fees,
    updated_at = NOW();
END;
$$;

-- Function to get delivery reports
CREATE OR REPLACE FUNCTION get_delivery_reports(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  daily_analytics JSON;
  driver_performance JSON;
  zone_performance JSON;
  summary_stats JSON;
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RETURN json_build_object('error', 'Access denied');
  END IF;

  -- Get daily analytics
  SELECT json_agg(
    json_build_object(
      'date', date,
      'total_deliveries', total_deliveries,
      'completed_deliveries', completed_deliveries,
      'failed_deliveries', failed_deliveries,
      'total_delivery_fees', total_delivery_fees,
      'average_delivery_time_minutes', average_delivery_time_minutes,
      'success_rate', CASE 
        WHEN total_deliveries > 0 THEN (completed_deliveries::FLOAT / total_deliveries * 100)::NUMERIC(5,2)
        ELSE 0
      END
    )
  ) INTO daily_analytics
  FROM delivery_analytics
  WHERE date BETWEEN start_date AND end_date
  ORDER BY date DESC;

  -- Get driver performance
  SELECT json_agg(
    json_build_object(
      'driver_id', da.driver_id,
      'driver_name', d.name,
      'total_deliveries', SUM(da.deliveries_completed + da.deliveries_failed),
      'completed_deliveries', SUM(da.deliveries_completed),
      'failed_deliveries', SUM(da.deliveries_failed),
      'total_fees_collected', SUM(da.delivery_fees_collected),
      'average_delivery_time', AVG(da.total_delivery_time_minutes / NULLIF(da.deliveries_completed, 0)),
      'success_rate', CASE 
        WHEN SUM(da.deliveries_completed + da.deliveries_failed) > 0 
        THEN (SUM(da.deliveries_completed)::FLOAT / SUM(da.deliveries_completed + da.deliveries_failed) * 100)::NUMERIC(5,2)
        ELSE 0
      END
    )
  ) INTO driver_performance
  FROM driver_delivery_analytics da
  JOIN drivers d ON da.driver_id = d.id
  WHERE da.date BETWEEN start_date AND end_date
  GROUP BY da.driver_id, d.name
  ORDER BY SUM(da.deliveries_completed) DESC;

  -- Get zone performance
  SELECT json_agg(
    json_build_object(
      'zone_id', za.zone_id,
      'zone_name', dz.name,
      'total_deliveries', SUM(za.total_deliveries),
      'successful_deliveries', SUM(za.successful_deliveries),
      'total_fees', SUM(za.total_delivery_fees),
      'success_rate', CASE 
        WHEN SUM(za.total_deliveries) > 0 
        THEN (SUM(za.successful_deliveries)::FLOAT / SUM(za.total_deliveries) * 100)::NUMERIC(5,2)
        ELSE 0
      END
    )
  ) INTO zone_performance
  FROM zone_delivery_analytics za
  JOIN delivery_zones dz ON za.zone_id = dz.id
  WHERE za.date BETWEEN start_date AND end_date
  GROUP BY za.zone_id, dz.name
  ORDER BY SUM(za.successful_deliveries) DESC;

  -- Get summary statistics
  SELECT json_build_object(
    'total_revenue', COALESCE(SUM(total_delivery_fees), 0),
    'total_deliveries', COALESCE(SUM(total_deliveries), 0),
    'average_success_rate', CASE 
      WHEN SUM(total_deliveries) > 0 
      THEN (SUM(completed_deliveries)::FLOAT / SUM(total_deliveries) * 100)::NUMERIC(5,2)
      ELSE 0
    END,
    'average_delivery_time', COALESCE(AVG(average_delivery_time_minutes), 0)::NUMERIC(5,2),
    'period_start', start_date,
    'period_end', end_date
  ) INTO summary_stats
  FROM delivery_analytics
  WHERE date BETWEEN start_date AND end_date;

  RETURN json_build_object(
    'daily_analytics', COALESCE(daily_analytics, '[]'::json),
    'driver_performance', COALESCE(driver_performance, '[]'::json),
    'zone_performance', COALESCE(zone_performance, '[]'::json),
    'summary', COALESCE(summary_stats, '{}'::json)
  );
END;
$$;

-- Enable Row Level Security
ALTER TABLE delivery_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_delivery_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_delivery_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can view delivery analytics" ON delivery_analytics
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can view driver analytics" ON driver_delivery_analytics
  FOR SELECT USING (is_admin());

CREATE POLICY "Drivers can view their own analytics" ON driver_delivery_analytics
  FOR SELECT USING (
    driver_id IN (
      SELECT id FROM drivers WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view zone analytics" ON zone_delivery_analytics
  FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can manage delivery analytics" ON delivery_analytics
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service roles can manage driver analytics" ON driver_delivery_analytics
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service roles can manage zone analytics" ON zone_delivery_analytics
  FOR ALL USING (auth.role() = 'service_role');