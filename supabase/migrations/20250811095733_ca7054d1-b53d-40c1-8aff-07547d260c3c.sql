-- ========================================
-- 🚨 EMERGENCY PRODUCTION FIX
-- Payment Flow Complete Repair Script
-- ========================================

-- STEP 1: Fix Reference Format Standardization
-- Create unified reference generation function
CREATE OR REPLACE FUNCTION generate_payment_reference()
RETURNS TEXT AS $$
BEGIN
  -- Use consistent txn_ prefix for ALL references
  RETURN 'txn_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || gen_random_uuid()::text;
END;
$$ LANGUAGE plpgsql;

-- STEP 2: Update Orders Table for Reference Consistency
-- Add new column for Paystack reference tracking
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS paystack_reference TEXT,
ADD COLUMN IF NOT EXISTS reference_updated_at TIMESTAMPTZ DEFAULT NOW();

-- STEP 3: Fix Payment Transactions Creation
-- Enhanced RPC function for payment processing
CREATE OR REPLACE FUNCTION handle_successful_payment(
  p_paystack_reference TEXT,
  p_order_reference TEXT DEFAULT NULL,
  p_amount DECIMAL,
  p_currency TEXT DEFAULT 'NGN',
  p_paystack_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSON AS $$
DECLARE
  v_order_id UUID;
  v_payment_transaction_id UUID;
  v_result JSON;
BEGIN
  -- Log the attempt
  RAISE NOTICE 'Processing payment: paystack_ref=%, order_ref=%, amount=%', 
    p_paystack_reference, p_order_reference, p_amount;

  -- CRITICAL: Find order by EITHER reference format
  SELECT id INTO v_order_id
  FROM orders 
  WHERE 
    payment_reference = p_order_reference 
    OR paystack_reference = p_paystack_reference
    OR payment_reference = p_paystack_reference -- Handle reference mismatch
  LIMIT 1;

  -- If not found by reference, try to match by amount and recent timestamp
  IF v_order_id IS NULL THEN
    SELECT id INTO v_order_id
    FROM orders 
    WHERE 
      total_amount = p_amount 
      AND payment_status = 'pending'
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- If still no order found, create error record and return
  IF v_order_id IS NULL THEN
    INSERT INTO payment_transactions (
      reference, 
      amount, 
      currency, 
      status, 
      paystack_data,
      error_message,
      created_at
    ) VALUES (
      p_paystack_reference,
      p_amount,
      p_currency,
      'orphaned',
      p_paystack_data,
      'No matching order found for payment',
      NOW()
    );
    
    RETURN json_build_object(
      'success', false,
      'error', 'No matching order found',
      'paystack_reference', p_paystack_reference
    );
  END IF;

  -- Update order with Paystack reference if missing
  UPDATE orders 
  SET 
    paystack_reference = p_paystack_reference,
    reference_updated_at = NOW()
  WHERE id = v_order_id AND paystack_reference IS NULL;

  -- Create payment transaction record
  INSERT INTO payment_transactions (
    order_id,
    reference,
    amount,
    currency,
    status,
    paystack_data,
    created_at
  ) VALUES (
    v_order_id,
    p_paystack_reference,
    p_amount,
    p_currency,
    'completed',
    p_paystack_data,
    NOW()
  ) RETURNING id INTO v_payment_transaction_id;

  -- Update order status to completed
  UPDATE orders 
  SET 
    status = 'confirmed',
    payment_status = 'paid',
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = v_order_id;

  -- Log success
  RAISE NOTICE 'Payment processed successfully: order_id=%, payment_id=%', 
    v_order_id, v_payment_transaction_id;

  -- Return success result
  SELECT json_build_object(
    'success', true,
    'order_id', v_order_id,
    'payment_transaction_id', v_payment_transaction_id,
    'paystack_reference', p_paystack_reference
  ) INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and create error record
    RAISE NOTICE 'Payment processing error: %', SQLERRM;
    
    INSERT INTO payment_transactions (
      reference, 
      amount, 
      currency, 
      status, 
      paystack_data,
      error_message,
      created_at
    ) VALUES (
      p_paystack_reference,
      p_amount,
      p_currency,
      'error',
      p_paystack_data,
      SQLERRM,
      NOW()
    );
    
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'paystack_reference', p_paystack_reference
    );
END;
$$ LANGUAGE plpgsql;

-- STEP 4: Create Emergency Backfill Function
-- Fix all broken orders from last 48 hours
CREATE OR REPLACE FUNCTION emergency_backfill_broken_orders()
RETURNS JSON AS $$
DECLARE
  v_fixed_count INTEGER := 0;
  v_order_record RECORD;
  v_result JSON;
BEGIN
  RAISE NOTICE 'Starting emergency backfill of broken orders...';

  -- Find all broken orders and attempt to fix them
  FOR v_order_record IN
    SELECT DISTINCT o.id, o.payment_reference, o.total_amount
    FROM orders o
    WHERE 
      o.status = 'pending' 
      AND o.payment_status = 'pending'
      AND o.created_at > NOW() - INTERVAL '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM payment_transactions pt 
        WHERE pt.order_id = o.id OR pt.reference = o.payment_reference
      )
  LOOP
    -- Try to find successful payment in logs or create placeholder
    -- For now, mark as needing manual review
    UPDATE orders 
    SET 
      status = 'requires_review',
      payment_status = 'verification_needed',
      updated_at = NOW()
    WHERE id = v_order_record.id;
    
    v_fixed_count := v_fixed_count + 1;
    
    RAISE NOTICE 'Marked order % for manual review', v_order_record.id;
  END LOOP;

  SELECT json_build_object(
    'success', true,
    'orders_marked_for_review', v_fixed_count,
    'message', 'Orders marked for manual payment verification'
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- STEP 5: Create Production Monitoring Views
-- View for real-time payment flow health
CREATE OR REPLACE VIEW payment_flow_health AS
SELECT 
  'last_24h' as period,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as completed_orders,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
  COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_orders,
  COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as payment_pending,
  ROUND(
    COUNT(CASE WHEN status = 'confirmed' THEN 1 END)::numeric / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as completion_rate_percent
FROM orders 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- STEP 6: Create Alert Function
CREATE OR REPLACE FUNCTION check_payment_flow_health()
RETURNS JSON AS $$
DECLARE
  v_health RECORD;
  v_alerts JSON[];
  v_result JSON;
BEGIN
  SELECT * INTO v_health FROM payment_flow_health WHERE period = 'last_24h';
  
  v_alerts := ARRAY[]::JSON[];
  
  -- Check completion rate
  IF v_health.completion_rate_percent < 90 THEN
    v_alerts := v_alerts || json_build_object(
      'severity', 'critical',
      'message', 'Order completion rate below 90%: ' || v_health.completion_rate_percent || '%'
    );
  END IF;
  
  -- Check pending orders
  IF v_health.pending_orders > 10 THEN
    v_alerts := v_alerts || json_build_object(
      'severity', 'warning',
      'message', 'High number of pending orders: ' || v_health.pending_orders
    );
  END IF;
  
  SELECT json_build_object(
    'health_status', v_health,
    'alerts', v_alerts,
    'timestamp', NOW()
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- STEP 7: Grant Necessary Permissions
-- Ensure edge functions can call these RPCs
GRANT EXECUTE ON FUNCTION handle_successful_payment TO anon, authenticated;
GRANT EXECUTE ON FUNCTION emergency_backfill_broken_orders TO authenticated;
GRANT EXECUTE ON FUNCTION check_payment_flow_health TO anon, authenticated;
GRANT SELECT ON payment_flow_health TO anon, authenticated;

-- STEP 8: Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_orders_paystack_reference ON orders(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created ON orders(payment_status, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);