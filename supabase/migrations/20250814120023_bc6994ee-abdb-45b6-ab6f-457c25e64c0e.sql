-- First, let's create reasonable delivery schedules for existing delivery orders
-- This will backfill the missing delivery schedule data

INSERT INTO order_delivery_schedule (
  order_id,
  delivery_date,
  delivery_time_start,
  delivery_time_end,
  requested_at,
  is_flexible,
  special_instructions
)
SELECT 
  o.id as order_id,
  -- Set delivery date to 1 day after order creation for recent orders, 
  -- or same day for older orders to avoid past dates
  CASE 
    WHEN o.created_at::date >= CURRENT_DATE - INTERVAL '7 days' 
    THEN (o.created_at::date + INTERVAL '1 day')::date
    ELSE CURRENT_DATE + INTERVAL '1 day'
  END as delivery_date,
  -- Default morning delivery window
  '09:00' as delivery_time_start,
  '12:00' as delivery_time_end,
  o.created_at as requested_at,
  false as is_flexible,
  'Delivery schedule created during system migration' as special_instructions
FROM orders o
WHERE o.order_type = 'delivery'
  AND o.id NOT IN (SELECT order_id FROM order_delivery_schedule WHERE order_id IS NOT NULL)
  AND o.created_at IS NOT NULL;