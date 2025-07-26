-- Remove duplicate RLS policies on payment_transactions
DROP POLICY IF EXISTS "Service manage payment transactions" ON payment_transactions;

-- Clean up and consolidate payment_transactions policies
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

-- Create error logging table for better monitoring
CREATE TABLE IF NOT EXISTS payment_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  error_type text NOT NULL,
  error_message text NOT NULL,
  error_stack text,
  occurred_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on error logs
ALTER TABLE payment_error_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for error logs
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

-- Create webhook_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text NOT NULL,
  provider_event_id text,
  transaction_reference text,
  payload jsonb,
  processed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on webhook logs
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for webhook logs
CREATE POLICY "Admins can view webhook logs" ON webhook_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Service roles can manage webhook logs" ON webhook_logs
FOR ALL USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create saved_payment_methods table if it doesn't exist
CREATE TABLE IF NOT EXISTS saved_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  authorization_code text NOT NULL UNIQUE,
  card_type text,
  last4 text,
  exp_month text,
  exp_year text,
  bank text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on saved payment methods
ALTER TABLE saved_payment_methods ENABLE ROW LEVEL SECURITY;

-- Create policies for saved payment methods
CREATE POLICY "Users can manage their own payment methods" ON saved_payment_methods
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can view all payment methods" ON saved_payment_methods
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'manager', 'staff')
  )
);

-- Add missing columns to payment_transactions if they don't exist
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS transaction_reference text,
ADD COLUMN IF NOT EXISTS provider_reference text,
ADD COLUMN IF NOT EXISTS gateway_response text,
ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS fees numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS channel text,
ADD COLUMN IF NOT EXISTS authorization_code text,
ADD COLUMN IF NOT EXISTS card_type text,
ADD COLUMN IF NOT EXISTS last4 text,
ADD COLUMN IF NOT EXISTS exp_month text,
ADD COLUMN IF NOT EXISTS exp_year text,
ADD COLUMN IF NOT EXISTS bank text,
ADD COLUMN IF NOT EXISTS account_name text,
ADD COLUMN IF NOT EXISTS customer_email text;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_ref ON payment_transactions(provider_reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_reference ON webhook_logs(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_saved_payment_methods_user ON saved_payment_methods(user_id);