-- Update payment_integrations table to support Paystack
ALTER TABLE payment_integrations 
ADD COLUMN IF NOT EXISTS webhook_endpoints JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS supported_methods JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS test_mode BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
ADD COLUMN IF NOT EXISTS integration_data JSONB DEFAULT '{}';

-- Create payment_transactions table for detailed transaction tracking
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_reference TEXT UNIQUE NOT NULL,
  provider_reference TEXT UNIQUE,
  provider TEXT NOT NULL, -- 'stripe' or 'paystack'
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  payment_method TEXT,
  channel TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'abandoned', 'cancelled')),
  gateway_response TEXT,
  paid_at TIMESTAMPTZ,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  metadata JSONB DEFAULT '{}',
  fees DECIMAL(10,2) DEFAULT 0,
  authorization_code TEXT,
  card_type TEXT,
  last4 TEXT,
  exp_month TEXT,
  exp_year TEXT,
  bank TEXT,
  account_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for payment_transactions
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view transactions for their orders, staff can view all
CREATE POLICY "Users view own payment transactions" ON payment_transactions
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE customer_email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    ) OR 
    get_user_role(auth.uid()) = ANY(ARRAY['admin', 'manager', 'staff'])
  );

-- Service roles can manage transactions
CREATE POLICY "Service manage payment transactions" ON payment_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- Create saved payment methods table
CREATE TABLE IF NOT EXISTS saved_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'stripe' or 'paystack'
  authorization_code TEXT NOT NULL,
  card_type TEXT,
  last4 TEXT,
  exp_month TEXT,
  exp_year TEXT,
  bank TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for saved_payment_methods
ALTER TABLE saved_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own payment methods" ON saved_payment_methods
  FOR ALL USING (auth.uid() = user_id);

-- Create webhook_logs table for webhook processing
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider_event_id TEXT,
  transaction_reference TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for webhook_logs
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only webhook logs" ON webhook_logs
  FOR SELECT USING (get_user_role(auth.uid()) = 'admin');

-- Add trigger for updating payment_transactions timestamp
CREATE OR REPLACE FUNCTION update_payment_transaction_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_transactions_timestamp
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_transaction_timestamp();