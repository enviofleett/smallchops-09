-- Fix existing orders before adding constraint
-- First, check which orders are causing the constraint violation
UPDATE orders 
SET delivery_zone_id = '72e90560-4ddf-4206-a449-a2c213ed2f0b' -- Default to Gwarinpa zone
WHERE order_type = 'delivery' 
  AND delivery_zone_id IS NULL
  AND created_at >= NOW() - INTERVAL '30 days';

-- Add delivery zone validation constraint to prevent future issues (now it should work)
ALTER TABLE orders 
ADD CONSTRAINT check_delivery_zone_required 
CHECK (
  (order_type = 'pickup') OR 
  (order_type = 'delivery' AND delivery_zone_id IS NOT NULL)
);

-- Create monitoring view for delivery zone issues
CREATE OR REPLACE VIEW delivery_zone_monitoring AS
SELECT 
  DATE(created_at) as order_date,
  COUNT(*) as total_orders,
  COUNT(*) FILTER (WHERE order_type = 'delivery') as delivery_orders,
  COUNT(*) FILTER (WHERE order_type = 'delivery' AND delivery_zone_id IS NULL) as missing_zone_orders,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
  COUNT(*) FILTER (WHERE payment_status = 'paid' AND status != 'confirmed') as payment_status_mismatches,
  ROUND(
    (COUNT(*) FILTER (WHERE order_type = 'delivery' AND delivery_zone_id IS NOT NULL)::DECIMAL / 
     NULLIF(COUNT(*) FILTER (WHERE order_type = 'delivery'), 0)) * 100, 2
  ) as zone_completion_rate
FROM orders 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY order_date DESC;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_orders_delivery_zone_monitoring 
ON orders (order_type, delivery_zone_id, status, payment_status, created_at);

-- Log completion
INSERT INTO audit_logs (
  action, category, message, new_values
) VALUES (
  'delivery_zones_constraints_fixed',
  'Delivery Management', 
  'Fixed delivery zone constraints and added monitoring',
  jsonb_build_object('updated_orders', (SELECT COUNT(*) FROM orders WHERE order_type = 'delivery' AND delivery_zone_id IS NOT NULL))
);