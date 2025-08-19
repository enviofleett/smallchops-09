-- Add INSERT policy to allow customers to create their own delivery schedules
CREATE POLICY "Customers can create their own delivery schedules" 
ON public.order_delivery_schedule 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_delivery_schedule.order_id 
    AND orders.customer_id = (
      SELECT id FROM customer_accounts 
      WHERE user_id = auth.uid()
    )
  )
);