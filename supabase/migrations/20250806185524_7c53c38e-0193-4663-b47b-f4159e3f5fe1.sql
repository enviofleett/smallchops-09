-- Fix RLS policies for payment verification - addressing 403 errors

-- Enhanced RLS for payment_transactions (using correct column names)
DROP POLICY IF EXISTS "Users can view their own payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Service roles can manage all payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Users can create payment transactions" ON public.payment_transactions;

CREATE POLICY "Users can view their own payment transactions" ON public.payment_transactions
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL AND (
      -- Allow access if user is associated with the order
      order_id IN (
        SELECT id FROM orders WHERE customer_id IN (
          SELECT id FROM customer_accounts WHERE user_id = auth.uid()
        )
      ) OR
      -- Allow access if customer email matches user email
      customer_email IN (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Service roles can manage all payment transactions" ON public.payment_transactions
  FOR ALL 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can create payment transactions" ON public.payment_transactions
  FOR INSERT 
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      customer_email IN (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
  );

-- Enhanced RLS for orders
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Service roles can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;

CREATE POLICY "Customers can view their own orders" ON public.orders
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL AND (
      customer_id IN (
        SELECT id FROM customer_accounts WHERE user_id = auth.uid()
      ) OR
      -- Allow access if user email matches order email (for guest orders)
      customer_email IN (
        SELECT email FROM auth.users WHERE id = auth.uid()
      ) OR
      -- Allow access during checkout/payment process
      guest_session_id IN (
        SELECT id FROM customer_accounts WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service roles can manage all orders" ON public.orders
  FOR ALL 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT 
  USING (is_admin());