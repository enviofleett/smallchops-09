-- ========================================
-- 🔧 CRITICAL PAYMENT FIX: Missing RPC Function
-- Create verify_and_update_payment_status function
-- ========================================

-- This function is critical for payment verification and is called by:
-- - verify-payment/index.ts
-- - payment-callback/index.ts  
-- - test-verify-payment/index.ts

CREATE OR REPLACE FUNCTION public.verify_and_update_payment_status(
  payment_ref TEXT,
  new_status TEXT DEFAULT 'confirmed',
  payment_amount NUMERIC DEFAULT NULL,
  payment_gateway_response JSONB DEFAULT NULL
)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  status TEXT,
  amount NUMERIC,
  customer_email TEXT,
  order_type TEXT,
  payment_reference TEXT,
  updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_updated_order RECORD;
BEGIN
  -- Log the verification attempt
  RAISE NOTICE '[VERIFY_PAYMENT_RPC] Processing payment verification: ref=%, status=%, amount=%', 
    payment_ref, new_status, payment_amount;

  -- Find the order by payment reference
  SELECT 
    o.id,
    o.order_number,
    o.status,
    o.payment_status,
    o.total_amount,
    o.delivery_fee,
    o.customer_email,
    o.order_type,
    o.payment_reference,
    o.customer_id
  INTO v_order_record
  FROM orders o
  WHERE o.payment_reference = payment_ref
  LIMIT 1;

  -- If not found, raise exception
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for payment reference: %', payment_ref;
  END IF;

  -- Validate payment amount if provided
  IF payment_amount IS NOT NULL THEN
    DECLARE
      v_expected_amount NUMERIC;
      v_amount_difference NUMERIC;
    BEGIN
      v_expected_amount := COALESCE(v_order_record.total_amount, 0) + COALESCE(v_order_record.delivery_fee, 0);
      v_amount_difference := ABS(payment_amount - v_expected_amount);
      
      -- Allow 1 kobo tolerance for rounding
      IF v_amount_difference > 0.01 THEN
        -- Log security incident for amount mismatch
        INSERT INTO security_incidents (
          type,
          description,
          severity,
          reference,
          expected_amount,
          received_amount,
          created_at
        ) VALUES (
          'payment_amount_mismatch',
          format('Payment amount mismatch: paid ₦%s, expected ₦%s', payment_amount, v_expected_amount),
          'critical',
          payment_ref,
          v_expected_amount,
          payment_amount,
          NOW()
        );
        
        RAISE EXCEPTION 'Payment amount mismatch: paid ₦%, expected ₦%', payment_amount, v_expected_amount;
      END IF;
    END;
  END IF;

  -- Update the order status and payment information
  UPDATE orders 
  SET 
    status = new_status,
    payment_status = 'paid',
    paid_at = COALESCE(paid_at, NOW()),
    updated_at = NOW()
  WHERE id = v_order_record.id
  RETURNING 
    id,
    order_number,
    status,
    total_amount + COALESCE(delivery_fee, 0) as amount,
    customer_email,
    order_type,
    payment_reference,
    updated_at
  INTO v_updated_order;

  -- Create or update payment transaction record
  INSERT INTO payment_transactions (
    order_id,
    reference,
    provider_reference,
    amount,
    currency,
    status,
    gateway_response,
    verified_at,
    created_at,
    updated_at
  ) VALUES (
    v_updated_order.id,
    payment_ref,
    payment_ref,
    COALESCE(payment_amount, v_updated_order.amount),
    'NGN',
    'completed',
    payment_gateway_response,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (reference) 
  DO UPDATE SET
    status = 'completed',
    gateway_response = EXCLUDED.gateway_response,
    verified_at = NOW(),
    updated_at = NOW();

  -- Log successful verification
  RAISE NOTICE '[VERIFY_PAYMENT_RPC] Payment verified successfully: order_id=%, order_number=%, status=%', 
    v_updated_order.id, v_updated_order.order_number, v_updated_order.status;

  -- Return the updated order information
  RETURN QUERY
  SELECT 
    v_updated_order.id as order_id,
    v_updated_order.order_number,
    v_updated_order.status,
    v_updated_order.amount,
    v_updated_order.customer_email,
    v_updated_order.order_type,
    v_updated_order.payment_reference,
    v_updated_order.updated_at;

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    RAISE NOTICE '[VERIFY_PAYMENT_RPC] Error processing payment: %', SQLERRM;
    
    -- Create error payment transaction record
    INSERT INTO payment_transactions (
      reference,
      provider_reference,
      amount,
      currency,
      status,
      gateway_response,
      created_at,
      updated_at
    ) VALUES (
      payment_ref,
      payment_ref,
      COALESCE(payment_amount, 0),
      'NGN',
      'error',
      jsonb_build_object('error', SQLERRM, 'timestamp', NOW()),
      NOW(),
      NOW()
    )
    ON CONFLICT (reference) DO NOTHING;
    
    -- Re-raise the exception
    RAISE;
END;
$$;

-- Grant permissions to the function
GRANT EXECUTE ON FUNCTION public.verify_and_update_payment_status TO anon, authenticated, service_role;

-- Add function comment
COMMENT ON FUNCTION public.verify_and_update_payment_status IS 
'Securely verifies and updates payment status for orders. Used by payment verification edge functions.';

-- Create security incidents table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  reference TEXT,
  expected_amount NUMERIC,
  received_amount NUMERIC,
  metadata JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on security incidents
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

-- Only admins and service role can access security incidents
CREATE POLICY "Admin access to security incidents" 
  ON public.security_incidents 
  FOR ALL 
  USING (is_admin()) 
  WITH CHECK (is_admin());

CREATE POLICY "Service role access to security incidents" 
  ON public.security_incidents 
  FOR ALL 
  USING (auth.role() = 'service_role') 
  WITH CHECK (auth.role() = 'service_role');

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON public.security_incidents(type);
CREATE INDEX IF NOT EXISTS idx_security_incidents_reference ON public.security_incidents(reference);
CREATE INDEX IF NOT EXISTS idx_security_incidents_created_at ON public.security_incidents(created_at);
