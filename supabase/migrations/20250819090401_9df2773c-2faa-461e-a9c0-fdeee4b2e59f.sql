-- Add RLS policy to allow customers to view their own delivery schedules
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