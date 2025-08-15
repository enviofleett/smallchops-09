-- Create payment_transactions table if not exists with proper structure
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  reference TEXT UNIQUE NOT NULL,
  paystack_reference TEXT,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  status TEXT DEFAULT 'pending',
  provider TEXT DEFAULT 'paystack',
  environment TEXT DEFAULT 'test',
  paystack_status TEXT,
  gateway_response TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  channel TEXT,
  fees NUMERIC(10,2) DEFAULT 0,
  auth_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_paystack_reference ON payment_transactions(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);

-- Enable RLS 
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Service roles can manage payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Customers can view their payment transactions" ON payment_transactions;

-- Admin access policy
CREATE POLICY "payment_transactions_admin_policy" 
ON payment_transactions FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

-- Service role access policy
CREATE POLICY "payment_transactions_service_policy" 
ON payment_transactions FOR ALL 
USING (auth.role() = 'service_role') 
WITH CHECK (auth.role() = 'service_role');

-- Customer view access policy
CREATE POLICY "payment_transactions_customer_policy" 
ON payment_transactions FOR SELECT 
USING (
  order_id IN (
    SELECT o.id FROM orders o 
    WHERE o.customer_id IN (
      SELECT ca.id FROM customer_accounts ca 
      WHERE ca.user_id = auth.uid()
    ) OR (
      o.customer_email IS NOT NULL 
      AND o.customer_email IN (
        SELECT u.email FROM auth.users u 
        WHERE u.id = auth.uid()
      )
    )
  )
);