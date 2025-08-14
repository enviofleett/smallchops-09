-- Add indexes for delivery management performance (skip if exists)
CREATE INDEX IF NOT EXISTS idx_orders_delivery_type_status ON orders(order_type, status) WHERE order_type = 'delivery';
CREATE INDEX IF NOT EXISTS idx_orders_delivery_created_at ON orders(created_at) WHERE order_type = 'delivery';
CREATE INDEX IF NOT EXISTS idx_delivery_schedule_date ON order_delivery_schedule(delivery_date);
CREATE INDEX IF NOT EXISTS idx_delivery_schedule_order_id ON order_delivery_schedule(order_id);

-- Enable real-time updates for delivery management
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE order_delivery_schedule REPLICA IDENTITY FULL;

-- Add delivery performance tracking table (updated version)
CREATE TABLE IF NOT EXISTS delivery_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_deliveries INTEGER DEFAULT 0,
  on_time_deliveries INTEGER DEFAULT 0,
  late_deliveries INTEGER DEFAULT 0,
  average_delivery_time_minutes INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date)
);

-- Function to calculate daily delivery metrics
CREATE OR REPLACE FUNCTION calculate_delivery_metrics(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
  metrics_record RECORD;
BEGIN
  -- Calculate metrics for the target date
  SELECT 
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'delivered' OR status = 'completed') as completed_deliveries,
    SUM(total_amount) as revenue,
    AVG(
      EXTRACT(EPOCH FROM (updated_at - created_at)) / 60
    )::INTEGER as avg_time_minutes
  INTO metrics_record
  FROM orders o
  LEFT JOIN order_delivery_schedule ods ON o.id = ods.order_id
  WHERE o.order_type = 'delivery'
    AND DATE(COALESCE(ods.delivery_date::date, o.created_at::date)) = target_date;

  -- Insert or update metrics
  INSERT INTO delivery_performance_metrics (
    date, 
    total_deliveries, 
    on_time_deliveries,
    average_delivery_time_minutes,
    total_revenue,
    updated_at
  ) VALUES (
    target_date,
    COALESCE(metrics_record.total_deliveries, 0),
    COALESCE(metrics_record.completed_deliveries, 0),
    COALESCE(metrics_record.avg_time_minutes, 0),
    COALESCE(metrics_record.revenue, 0),
    NOW()
  )
  ON CONFLICT (date) 
  DO UPDATE SET
    total_deliveries = EXCLUDED.total_deliveries,
    on_time_deliveries = EXCLUDED.on_time_deliveries,
    average_delivery_time_minutes = EXCLUDED.average_delivery_time_minutes,
    total_revenue = EXCLUDED.total_revenue,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;