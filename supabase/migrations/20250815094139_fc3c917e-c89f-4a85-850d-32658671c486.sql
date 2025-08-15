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

-- Create index for efficient lookups
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

-- Function to generate payment references
CREATE OR REPLACE FUNCTION public.generate_payment_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  timestamp_part TEXT;
  random_suffix TEXT;
BEGIN
  -- Use current timestamp in milliseconds
  timestamp_part := EXTRACT(EPOCH FROM NOW() * 1000)::BIGINT::TEXT;
  
  -- Generate random suffix (8 characters)
  random_suffix := substr(gen_random_uuid()::text, 1, 8);
  
  -- Return txn_timestamp_suffix format
  RETURN 'txn_' || timestamp_part || '_' || random_suffix;
END;
$$;

-- Function to create payment intent
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_order_id UUID,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'NGN'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reference TEXT;
  v_intent_id UUID;
  v_order_exists BOOLEAN;
BEGIN
  -- Check if order exists and is valid
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = p_order_id AND payment_status = 'pending') INTO v_order_exists;
  
  IF NOT v_order_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found or already paid'
    );
  END IF;
  
  -- Generate unique reference
  v_reference := generate_payment_reference();
  
  -- Create payment intent
  INSERT INTO payment_intents (order_id, reference, amount, currency)
  VALUES (p_order_id, v_reference, p_amount, p_currency)
  RETURNING id INTO v_intent_id;
  
  -- Update order with payment reference
  UPDATE orders 
  SET payment_reference = v_reference, updated_at = NOW()
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'intent_id', v_intent_id,
    'reference', v_reference,
    'amount', p_amount,
    'currency', p_currency
  );
END;
$$;

-- Migration function to normalize pay_* references to txn_*
CREATE OR REPLACE FUNCTION public.migrate_payment_references()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_count INTEGER := 0;
  v_record RECORD;
  v_new_reference TEXT;
BEGIN
  -- Update orders with pay_* references
  FOR v_record IN 
    SELECT id, payment_reference 
    FROM orders 
    WHERE payment_reference LIKE 'pay_%'
  LOOP
    -- Convert pay_timestamp_suffix to txn_timestamp_suffix
    v_new_reference := 'txn_' || substring(v_record.payment_reference from 5);
    
    UPDATE orders 
    SET payment_reference = v_new_reference,
        updated_at = NOW()
    WHERE id = v_record.id;
    
    v_updated_count := v_updated_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_orders', v_updated_count,
    'message', 'Successfully migrated ' || v_updated_count || ' payment references from pay_* to txn_* format'
  );
END;
$$;

-- Enhanced payment transactions table
ALTER TABLE public.payment_transactions 
ADD COLUMN IF NOT EXISTS gateway_reference TEXT,
ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_verification_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS error_details JSONB DEFAULT '{}';

-- Create index for gateway reference
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_ref ON payment_transactions(gateway_reference);

-- Update verify_and_update_payment_status function with comprehensive signature
CREATE OR REPLACE FUNCTION public.verify_and_update_payment_status(
  p_order_id TEXT,
  p_reference TEXT,
  p_provider_ref TEXT,
  p_provider TEXT,
  p_new_state TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_raw JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_normalized_ref TEXT;
  v_transaction_id UUID;
  v_result JSONB;
BEGIN
  -- Normalize reference format
  v_normalized_ref := p_reference;
  IF p_reference LIKE 'pay_%' THEN
    v_normalized_ref := 'txn_' || substring(p_reference from 5);
  END IF;
  
  -- Find order by ID or reference
  SELECT * INTO v_order_record
  FROM orders 
  WHERE id = p_order_id::UUID 
     OR payment_reference = v_normalized_ref
     OR payment_reference = p_reference;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found',
      'order_id', p_order_id,
      'reference', p_reference
    );
  END IF;
  
  -- Skip if already paid
  IF v_order_record.payment_status = 'paid' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Order already paid',
      'order_id', v_order_record.id,
      'status', v_order_record.status
    );
  END IF;
  
  -- Create or update payment transaction
  INSERT INTO payment_transactions (
    order_id,
    provider_reference,
    gateway_reference,
    amount,
    currency,
    status,
    provider_response,
    verification_attempts,
    last_verification_at,
    created_at,
    updated_at
  ) VALUES (
    v_order_record.id,
    v_normalized_ref,
    p_provider_ref,
    p_amount,
    p_currency,
    CASE p_new_state 
      WHEN 'paid' THEN 'paid'
      WHEN 'failed' THEN 'failed'
      ELSE 'pending'
    END,
    p_raw,
    1,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (provider_reference) 
  DO UPDATE SET
    gateway_reference = p_provider_ref,
    amount = p_amount,
    status = CASE p_new_state 
      WHEN 'paid' THEN 'paid'
      WHEN 'failed' THEN 'failed'
      ELSE 'pending'
    END,
    provider_response = p_raw,
    verification_attempts = payment_transactions.verification_attempts + 1,
    last_verification_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_transaction_id;
  
  -- Update order status if payment successful
  IF p_new_state = 'paid' THEN
    UPDATE orders 
    SET 
      payment_status = 'paid',
      status = 'confirmed',
      paid_at = NOW(),
      updated_at = NOW()
    WHERE id = v_order_record.id;
  END IF;
  
  -- Update payment intent if exists
  UPDATE payment_intents 
  SET 
    status = CASE p_new_state 
      WHEN 'paid' THEN 'succeeded'
      WHEN 'failed' THEN 'failed'
      ELSE 'processing'
    END,
    updated_at = NOW()
  WHERE order_id = v_order_record.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_record.id,
    'order_number', v_order_record.order_number,
    'status', CASE p_new_state WHEN 'paid' THEN 'confirmed' ELSE v_order_record.status END,
    'payment_status', CASE p_new_state WHEN 'paid' THEN 'paid' ELSE 'pending' END,
    'amount', v_order_record.total_amount,
    'customer_email', v_order_record.customer_email,
    'updated_at', NOW()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'order_id', p_order_id,
      'reference', p_reference
    );
END;
$$;

-- Create unified payment view
CREATE OR REPLACE VIEW public.orders_with_payment AS
SELECT 
  o.id,
  o.order_number,
  o.customer_id,
  o.customer_email,
  o.customer_name,
  o.status,
  o.payment_status,
  o.payment_reference,
  o.total_amount,
  o.order_type,
  o.created_at,
  o.updated_at,
  o.paid_at,
  pi.id as payment_intent_id,
  pi.status as intent_status,
  pt.id as transaction_id,
  pt.status as transaction_status,
  pt.provider_reference,
  pt.gateway_reference,
  pt.verification_attempts,
  pt.last_verification_at
FROM orders o
LEFT JOIN payment_intents pi ON o.id = pi.order_id
LEFT JOIN payment_transactions pt ON o.payment_reference = pt.provider_reference;

-- Grant access to the view
GRANT SELECT ON public.orders_with_payment TO authenticated, anon;