-- Drop the existing view first to avoid column conflicts
DROP VIEW IF EXISTS public.orders_with_payment;

-- PHASE 1: Create payment_intents table and reference generation
CREATE TABLE IF NOT EXISTS public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  client_secret TEXT,
  provider TEXT NOT NULL DEFAULT 'paystack',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_payment_intents_reference ON payment_intents(reference);
CREATE INDEX IF NOT EXISTS idx_payment_intents_order_id ON payment_intents(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);

-- RLS policies for payment_intents
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their payment intents" ON public.payment_intents
FOR SELECT USING (
  order_id IN (
    SELECT o.id FROM orders o 
    WHERE o.customer_id IN (
      SELECT ca.id FROM customer_accounts ca WHERE ca.user_id = auth.uid()
    )
    OR (o.customer_email IS NOT NULL AND lower(o.customer_email) = current_user_email())
  )
);

CREATE POLICY "Service roles can manage payment intents" ON public.payment_intents
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage payment intents" ON public.payment_intents
FOR ALL USING (is_admin());