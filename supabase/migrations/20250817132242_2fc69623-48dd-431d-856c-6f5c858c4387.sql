-- Production Payment Fix Migration v2
-- Version: 2025-08-17-production-fix

-- Create payment_transactions table with all required columns
CREATE TABLE IF NOT EXISTS payment_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference text UNIQUE NOT NULL,
    order_id uuid,
    amount numeric(12,2) NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    provider text DEFAULT 'paystack',
    provider_reference text,
    authorization_url text,
    access_code text,
    created_at timestamp with time zone DEFAULT now(),
    verified_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    gateway_response jsonb
);

-- Add payment_reference to orders if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_reference') THEN
        ALTER TABLE orders ADD COLUMN payment_reference text;
    END IF;
END $$;

-- Add paystack_reference to orders if missing  
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paystack_reference') THEN
        ALTER TABLE orders ADD COLUMN paystack_reference text;
    END IF;
END $$;

-- Add foreign key constraint after both tables exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payment_transactions_order_id_fkey'
    ) THEN
        ALTER TABLE payment_transactions 
        ADD CONSTRAINT payment_transactions_order_id_fkey 
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(payment_reference);
CREATE INDEX IF NOT EXISTS idx_orders_paystack_reference ON orders(paystack_reference);

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_payment_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
DROP TRIGGER IF EXISTS update_payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER update_payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_payment_transactions_updated_at();

-- Enable RLS on payment_transactions
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payment_transactions
DROP POLICY IF EXISTS "Admins can manage all payment transactions" ON payment_transactions;
CREATE POLICY "Admins can manage all payment transactions"
ON payment_transactions FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Service roles can manage payment transactions" ON payment_transactions;
CREATE POLICY "Service roles can manage payment transactions"
ON payment_transactions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Customers can view their own payment transactions" ON payment_transactions;
CREATE POLICY "Customers can view their own payment transactions"
ON payment_transactions FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT o.id FROM orders o
    WHERE (
      (o.customer_id IS NOT NULL AND o.customer_id IN (
        SELECT ca.id FROM customer_accounts ca WHERE ca.user_id = auth.uid()
      )) OR
      (o.customer_email IS NOT NULL AND lower(o.customer_email) = lower((auth.jwt() ->> 'email')))
    )
  )
);