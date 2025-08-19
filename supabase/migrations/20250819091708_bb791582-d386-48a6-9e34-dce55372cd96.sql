-- Database hardening for delivery schedule persistence

-- Add SELECT policy for customers to read their own delivery schedules
CREATE POLICY "Customers can view their own delivery schedules" 
ON public.order_delivery_schedule 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_delivery_schedule.order_id 
    AND orders.customer_id = (
      SELECT id FROM customer_accounts 
      WHERE user_id = auth.uid()
    )
  )
);

-- Add UPDATE policy for customers to modify their own delivery schedules (before fulfillment)
CREATE POLICY "Customers can update their own delivery schedules" 
ON public.order_delivery_schedule 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_delivery_schedule.order_id 
    AND orders.customer_id = (
      SELECT id FROM customer_accounts 
      WHERE user_id = auth.uid()
    )
    AND orders.status IN ('pending', 'confirmed', 'preparing')
  )
);

-- Add unique index to guarantee one schedule per order and make operations idempotent
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_delivery_schedule_order_id 
ON public.order_delivery_schedule(order_id);

-- One-off backfill for order ORD-20250819-2515
-- Insert delivery schedule captured during checkout
INSERT INTO public.order_delivery_schedule (
  order_id,
  delivery_date,
  delivery_time_start,
  delivery_time_end,
  is_flexible,
  special_instructions,
  requested_at
) VALUES (
  'e66f056f-36fd-4e80-912f-cc5ba6091c7a',
  '2025-08-19',
  '12:00',
  '13:00',
  false,
  'call me ',
  '2025-08-19T09:07:34.820Z'::timestamp with time zone
)
ON CONFLICT (order_id) DO NOTHING;

-- Log the backfill operation
INSERT INTO audit_logs (
  action, 
  category, 
  message, 
  entity_id, 
  new_values
) VALUES (
  'delivery_schedule_backfilled',
  'Order Management',
  'Delivery schedule backfilled for order ORD-20250819-2515',
  'e66f056f-36fd-4e80-912f-cc5ba6091c7a',
  jsonb_build_object(
    'order_id', 'e66f056f-36fd-4e80-912f-cc5ba6091c7a',
    'order_number', 'ORD-20250819-2515',
    'delivery_date', '2025-08-19',
    'delivery_window', '12:00-13:00',
    'backfill_reason', 'Missing schedule from process-checkout'
  )
);