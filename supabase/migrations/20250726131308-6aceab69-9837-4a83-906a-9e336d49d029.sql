-- Phase 1: Create missing tables for complete Paystack integration

-- Webhook logs table for comprehensive event tracking
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  paystack_event_id TEXT UNIQUE,
  transaction_reference TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  processing_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transaction analytics table for reporting
CREATE TABLE IF NOT EXISTS transaction_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_transactions INTEGER DEFAULT 0,
  successful_transactions INTEGER DEFAULT 0,
  failed_transactions INTEGER DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  total_fees DECIMAL(10,2) DEFAULT 0,
  channels_used JSONB DEFAULT '{}',
  average_transaction_value DECIMAL(10,2) DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date)
);

-- Enhanced payment error logs
CREATE TABLE IF NOT EXISTS payment_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  transaction_reference TEXT,
  request_payload JSONB,
  response_payload JSONB,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer payment preferences
CREATE TABLE IF NOT EXISTS customer_payment_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_currency TEXT DEFAULT 'NGN',
  preferred_payment_method TEXT DEFAULT 'card',
  save_payment_methods BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add missing columns to existing tables
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS channel TEXT,
ADD COLUMN IF NOT EXISTS account_name TEXT,
ADD COLUMN IF NOT EXISTS gateway_response TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS provider_reference TEXT,
ADD COLUMN IF NOT EXISTS fees DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS authorization_code TEXT,
ADD COLUMN IF NOT EXISTS card_type TEXT,
ADD COLUMN IF NOT EXISTS last4 TEXT,
ADD COLUMN IF NOT EXISTS exp_month TEXT,
ADD COLUMN IF NOT EXISTS exp_year TEXT,
ADD COLUMN IF NOT EXISTS bank TEXT;

-- Enhance saved payment methods table
ALTER TABLE saved_payment_methods 
ADD COLUMN IF NOT EXISTS nickname TEXT,
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS on new tables
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payment_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for webhook_logs
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

-- RLS policies for transaction_analytics
CREATE POLICY "Admins can view analytics" ON transaction_analytics
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Service roles can manage analytics" ON transaction_analytics
FOR ALL USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- RLS policies for payment_error_logs
CREATE POLICY "Admins can view error logs" ON payment_error_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Service roles can insert error logs" ON payment_error_logs
FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- RLS policies for customer_payment_preferences
CREATE POLICY "Users can manage own preferences" ON customer_payment_preferences
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all preferences" ON customer_payment_preferences
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed ON webhook_logs(processed);

CREATE INDEX IF NOT EXISTS idx_transaction_analytics_date ON transaction_analytics(date);

CREATE INDEX IF NOT EXISTS idx_payment_error_logs_occurred_at ON payment_error_logs(occurred_at);
CREATE INDEX IF NOT EXISTS idx_payment_error_logs_resolved ON payment_error_logs(resolved);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_reference ON payment_transactions(provider_reference);

-- Function to update transaction analytics
CREATE OR REPLACE FUNCTION update_transaction_analytics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO transaction_analytics (
    date,
    total_transactions,
    successful_transactions,
    failed_transactions,
    total_amount,
    total_fees,
    channels_used,
    average_transaction_value,
    success_rate
  )
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE status = 'success') as successful_transactions,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_transactions,
    COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0) as total_amount,
    COALESCE(SUM(fees) FILTER (WHERE status = 'success'), 0) as total_fees,
    jsonb_object_agg(COALESCE(channel, 'unknown'), COUNT(*)) as channels_used,
    COALESCE(AVG(amount) FILTER (WHERE status = 'success'), 0) as average_transaction_value,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE status = 'success')::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0 
    END as success_rate
  FROM payment_transactions 
  WHERE DATE(created_at) = DATE(NEW.created_at)
  GROUP BY DATE(created_at)
  ON CONFLICT (date) DO UPDATE SET
    total_transactions = EXCLUDED.total_transactions,
    successful_transactions = EXCLUDED.successful_transactions,
    failed_transactions = EXCLUDED.failed_transactions,
    total_amount = EXCLUDED.total_amount,
    total_fees = EXCLUDED.total_fees,
    channels_used = EXCLUDED.channels_used,
    average_transaction_value = EXCLUDED.average_transaction_value,
    success_rate = EXCLUDED.success_rate,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for analytics updates
DROP TRIGGER IF EXISTS trigger_update_transaction_analytics ON payment_transactions;
CREATE TRIGGER trigger_update_transaction_analytics
  AFTER INSERT OR UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_analytics();