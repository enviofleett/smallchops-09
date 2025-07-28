-- CRITICAL PHASE 1: Emergency Security Fixes
-- Create security infrastructure tables and atomic payment functions

-- Create security incidents table for breach tracking
CREATE TABLE IF NOT EXISTS public.security_incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  request_data JSONB,
  expected_signature TEXT,
  received_signature TEXT,
  error_message TEXT,
  reference TEXT,
  expected_amount NUMERIC,
  received_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create webhook events table for deduplication
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paystack_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  signature TEXT NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processing_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  UNIQUE(paystack_event_id, event_type)
);

-- Create payment audit log for complete tracking
CREATE TABLE IF NOT EXISTS public.payment_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_reference TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  changed_by UUID REFERENCES auth.users(id),
  ip_address INET,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create rate limits table for distributed rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_paystack_id ON public.webhook_events(paystack_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON public.security_incidents(type, created_at);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON public.security_incidents(severity, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_audit_reference ON public.payment_audit_log(payment_reference);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON public.rate_limits(expires_at);

-- CRITICAL: Create atomic payment verification function
CREATE OR REPLACE FUNCTION public.verify_payment_atomic(
  p_reference TEXT,
  p_paystack_data JSONB,
  p_verified_at TIMESTAMPTZ
) 
RETURNS JSONB AS $$
DECLARE
  v_payment_record RECORD;
  v_order_record RECORD;
  v_paystack_amount INTEGER;
  v_expected_amount INTEGER;
  v_result JSONB;
BEGIN
  -- Start atomic transaction
  BEGIN
    -- Get payment record with order details
    SELECT p.*, o.total_amount as order_total
    INTO v_payment_record
    FROM payment_transactions p
    LEFT JOIN orders o ON p.order_id = o.id
    WHERE p.provider_reference = p_reference;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment with reference % not found', p_reference;
    END IF;

    -- Extract amount from Paystack data (in kobo)
    v_paystack_amount := (p_paystack_data->>'amount')::INTEGER;
    v_expected_amount := ROUND(v_payment_record.amount * 100); -- Convert to kobo

    -- Verify amount matches
    IF v_paystack_amount != v_expected_amount THEN
      -- Log security incident
      INSERT INTO public.security_incidents (
        type,
        description,
        severity,
        reference,
        expected_amount,
        received_amount,
        request_data
      ) VALUES (
        'amount_mismatch',
        'Payment amount mismatch detected during verification',
        'critical',
        p_reference,
        v_expected_amount,
        v_paystack_amount,
        p_paystack_data
      );
      
      RAISE EXCEPTION 'Payment amount mismatch: expected %, received %', v_expected_amount, v_paystack_amount;
    END IF;

    -- Update payment status
    UPDATE payment_transactions 
    SET 
      status = 'success',
      provider_response = p_paystack_data,
      paid_at = p_verified_at,
      processed_at = NOW(),
      updated_at = NOW()
    WHERE provider_reference = p_reference;

    -- Update related order status if exists
    IF v_payment_record.order_id IS NOT NULL THEN
      UPDATE orders 
      SET 
        payment_status = 'paid',
        status = 'confirmed',
        updated_at = NOW()
      WHERE id = v_payment_record.order_id;

      -- Update inventory atomically
      UPDATE products 
      SET 
        stock_quantity = stock_quantity - oi.quantity,
        updated_at = NOW()
      FROM order_items oi
      WHERE oi.order_id = v_payment_record.order_id 
        AND products.id = oi.product_id;

      -- Check for negative inventory
      IF EXISTS (
        SELECT 1 FROM products p2
        JOIN order_items oi2 ON p2.id = oi2.product_id
        WHERE oi2.order_id = v_payment_record.order_id
          AND p2.stock_quantity < 0
      ) THEN
        RAISE EXCEPTION 'Insufficient inventory for order %', v_payment_record.order_id;
      END IF;
    END IF;

    -- Log successful verification
    INSERT INTO public.payment_audit_log (
      payment_reference,
      action,
      previous_status,
      new_status,
      metadata
    ) VALUES (
      p_reference,
      'verify_payment_atomic',
      'pending',
      'verified',
      jsonb_build_object(
        'paystack_amount', v_paystack_amount,
        'expected_amount', v_expected_amount,
        'order_id', v_payment_record.order_id
      )
    );

    v_result := jsonb_build_object(
      'success', true,
      'payment_id', v_payment_record.id,
      'order_id', v_payment_record.order_id,
      'amount', v_payment_record.amount,
      'verified_at', p_verified_at
    );

    RETURN v_result;

  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error
      INSERT INTO public.security_incidents (
        type,
        description,
        severity,
        reference,
        error_message,
        request_data
      ) VALUES (
        'payment_verification_error',
        'Error during atomic payment verification',
        'high',
        p_reference,
        SQLERRM,
        p_paystack_data
      );
      
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- CRITICAL: Create atomic payment confirmation function for webhooks
CREATE OR REPLACE FUNCTION public.confirm_payment_atomic(
  p_reference TEXT,
  p_amount INTEGER,
  p_paystack_data JSONB,
  p_confirmed_at TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
  v_transaction_record RECORD;
  v_expected_amount INTEGER;
  v_result JSONB;
BEGIN
  BEGIN
    -- Get payment transaction details
    SELECT pt.*, o.total_amount as order_total
    INTO v_transaction_record
    FROM payment_transactions pt
    LEFT JOIN orders o ON pt.order_id = o.id
    WHERE pt.provider_reference = p_reference;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transaction with reference % not found', p_reference;
    END IF;

    -- Calculate expected amount in kobo
    v_expected_amount := ROUND(v_transaction_record.amount * 100);

    -- Verify amount matches
    IF v_expected_amount != p_amount THEN
      -- Log security incident
      INSERT INTO public.security_incidents (
        type,
        description,
        severity,
        reference,
        expected_amount,
        received_amount,
        request_data
      ) VALUES (
        'webhook_amount_mismatch',
        'Webhook amount mismatch detected',
        'critical',
        p_reference,
        v_expected_amount,
        p_amount,
        p_paystack_data
      );
      
      RAISE EXCEPTION 'Amount mismatch: expected %, received %', v_expected_amount, p_amount;
    END IF;

    -- Update payment transaction
    UPDATE payment_transactions 
    SET 
      status = 'success',
      provider_response = p_paystack_data,
      paid_at = p_confirmed_at,
      processed_at = NOW(),
      updated_at = NOW()
    WHERE provider_reference = p_reference;

    -- Update order if exists
    IF v_transaction_record.order_id IS NOT NULL THEN
      UPDATE orders 
      SET 
        payment_status = 'paid',
        status = 'processing',
        updated_at = NOW()
      WHERE id = v_transaction_record.order_id;

      -- Reserve inventory atomically
      UPDATE products 
      SET 
        stock_quantity = stock_quantity - oi.quantity,
        updated_at = NOW()
      FROM order_items oi
      WHERE oi.order_id = v_transaction_record.order_id 
        AND products.id = oi.product_id;

      -- Check inventory availability
      IF EXISTS (
        SELECT 1 FROM products p2
        JOIN order_items oi2 ON p2.id = oi2.product_id
        WHERE oi2.order_id = v_transaction_record.order_id
          AND p2.stock_quantity < 0
      ) THEN
        RAISE EXCEPTION 'Insufficient inventory available for order %', v_transaction_record.order_id;
      END IF;
    END IF;

    -- Log confirmation
    INSERT INTO public.payment_audit_log (
      payment_reference,
      action,
      previous_status,
      new_status,
      metadata
    ) VALUES (
      p_reference,
      'confirm_payment_webhook',
      v_transaction_record.status,
      'success',
      jsonb_build_object(
        'webhook_amount', p_amount,
        'expected_amount', v_expected_amount,
        'order_id', v_transaction_record.order_id
      )
    );

    v_result := jsonb_build_object(
      'success', true,
      'transaction_id', v_transaction_record.id,
      'order_id', v_transaction_record.order_id,
      'confirmed_at', p_confirmed_at
    );

    RETURN v_result;

  EXCEPTION
    WHEN OTHERS THEN
      -- Log error
      INSERT INTO public.security_incidents (
        type,
        description,
        severity,
        reference,
        error_message,
        request_data
      ) VALUES (
        'payment_confirmation_error',
        'Error during atomic payment confirmation',
        'high',
        p_reference,
        SQLERRM,
        p_paystack_data
      );
      
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Auto-cleanup expired rate limits
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Enable RLS on new tables
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for security incidents (admin only)
CREATE POLICY "Admins can view all security incidents" ON public.security_incidents
  FOR ALL USING (is_admin());

-- RLS policies for webhook events (service role and admin)
CREATE POLICY "Service role can manage webhook events" ON public.webhook_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view webhook events" ON public.webhook_events
  FOR SELECT USING (is_admin());

-- RLS policies for payment audit log (admin only)
CREATE POLICY "Admins can view payment audit log" ON public.payment_audit_log
  FOR ALL USING (is_admin());

-- RLS policies for rate limits (service role only)
CREATE POLICY "Service role can manage rate limits" ON public.rate_limits
  FOR ALL USING (auth.role() = 'service_role');