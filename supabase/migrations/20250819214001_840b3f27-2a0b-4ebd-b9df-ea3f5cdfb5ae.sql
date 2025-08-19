-- Backfill missing delivery schedule for order ORD-20250819-7232
-- This order exists and is paid but missing delivery schedule data

INSERT INTO order_delivery_schedule (
  order_id, 
  delivery_date, 
  delivery_time_start, 
  delivery_time_end, 
  is_flexible, 
  special_instructions, 
  requested_at
) VALUES (
  'd71df0b0-bc79-4b4c-9cf7-9e9a8f8d3fd6',
  '2025-08-20',  -- Default to tomorrow for delivery
  '09:00',       -- Business hours start
  '17:00',       -- Business hours end
  true,          -- Flexible delivery
  'Schedule recovered by system - please verify delivery details with customer',
  NOW()
) 
ON CONFLICT (order_id) DO NOTHING;