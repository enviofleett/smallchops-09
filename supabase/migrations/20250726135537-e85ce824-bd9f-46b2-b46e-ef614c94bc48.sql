-- Add missing columns to payment_transactions table
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Create payment refunds table
CREATE TABLE IF NOT EXISTS payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  provider_refund_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for payment_refunds
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage refunds" ON payment_refunds
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add missing fields to saved_payment_methods for better UX
ALTER TABLE saved_payment_methods 
ADD COLUMN IF NOT EXISTS nickname TEXT,
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- Add trigger for updating refunds timestamp
CREATE OR REPLACE FUNCTION update_refunds_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_refunds_timestamp
  BEFORE UPDATE ON payment_refunds
  FOR EACH ROW
  EXECUTE FUNCTION update_refunds_timestamp();