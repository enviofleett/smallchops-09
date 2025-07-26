-- Remove all existing policies and recreate them properly
DROP POLICY IF EXISTS "Customers can view their own transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Service manage payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users view own payment transactions" ON payment_transactions;

-- Create consolidated policy for customer access  
CREATE POLICY "Customers can view their own transactions" ON payment_transactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = payment_transactions.order_id 
    AND orders.customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Create missing tables
CREATE TABLE IF NOT EXISTS payment_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  error_type text NOT NULL,
  error_message text NOT NULL,
  error_stack text,
  occurred_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE payment_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all error logs" ON payment_error_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Service roles can insert error logs" ON payment_error_logs
FOR INSERT WITH CHECK (auth.role() = 'service_role');