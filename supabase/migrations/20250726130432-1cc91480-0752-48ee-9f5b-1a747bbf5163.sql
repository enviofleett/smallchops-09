-- Create database function for atomic payment processing
CREATE OR REPLACE FUNCTION handle_successful_payment(
  p_reference text,
  p_paid_at timestamp with time zone,
  p_gateway_response text,
  p_fees numeric,
  p_channel text,
  p_authorization_code text DEFAULT NULL,
  p_card_type text DEFAULT NULL,
  p_last4 text DEFAULT NULL,
  p_exp_month text DEFAULT NULL,
  p_exp_year text DEFAULT NULL,
  p_bank text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_transaction_id uuid;
  v_order_id uuid;
BEGIN
  -- Update payment transaction atomically
  UPDATE payment_transactions 
  SET 
    status = 'success',
    paid_at = p_paid_at,
    gateway_response = p_gateway_response,
    fees = p_fees,
    channel = p_channel,
    authorization_code = p_authorization_code,
    card_type = p_card_type,
    last4 = p_last4,
    exp_month = p_exp_month,
    exp_year = p_exp_year,
    bank = p_bank,
    processed_at = now()
  WHERE provider_reference = p_reference
  RETURNING id, order_id INTO v_transaction_id, v_order_id;

  -- If no transaction found, raise exception
  IF v_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Transaction with reference % not found', p_reference;
  END IF;

  -- Update order status if order exists
  IF v_order_id IS NOT NULL THEN
    UPDATE orders 
    SET 
      payment_status = 'paid',
      status = 'confirmed',
      updated_at = now()
    WHERE id = v_order_id;
  END IF;

  -- Save payment method if authorization provided and not guest
  IF p_authorization_code IS NOT NULL THEN
    -- Get user_id from transaction metadata
    DECLARE
      v_user_id uuid;
    BEGIN
      SELECT (metadata->>'user_id')::uuid INTO v_user_id
      FROM payment_transactions 
      WHERE id = v_transaction_id;

      IF v_user_id IS NOT NULL THEN
        INSERT INTO saved_payment_methods (
          user_id,
          provider,
          authorization_code,
          card_type,
          last4,
          exp_month,
          exp_year,
          bank
        ) VALUES (
          v_user_id,
          'paystack',
          p_authorization_code,
          p_card_type,
          p_last4,
          p_exp_month,
          p_exp_year,
          p_bank
        ) ON CONFLICT (authorization_code) DO UPDATE SET
          is_active = true,
          updated_at = now();
      END IF;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create payment disputes table for dispute tracking
CREATE TABLE IF NOT EXISTS payment_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_reference text NOT NULL,
  dispute_id text NOT NULL UNIQUE,
  reason text,
  amount numeric NOT NULL,
  currency text DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'pending_review',
  resolution_notes text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on disputes
ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;

-- Create policies for disputes
CREATE POLICY "Admins can view all disputes" ON payment_disputes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Service roles can manage disputes" ON payment_disputes
FOR ALL USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Add rate limiting table for payment operations
CREATE TABLE IF NOT EXISTS payment_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  ip_address text,
  operation_type text NOT NULL,
  attempts integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_disputes_reference ON payment_disputes(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_status ON payment_disputes(status);
CREATE INDEX IF NOT EXISTS idx_payment_rate_limits_user ON payment_rate_limits(user_id, operation_type);
CREATE INDEX IF NOT EXISTS idx_payment_rate_limits_ip ON payment_rate_limits(ip_address, operation_type);