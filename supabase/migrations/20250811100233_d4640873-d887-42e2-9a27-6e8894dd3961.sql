-- ========================================
-- 🚨 EMERGENCY PRODUCTION FIX - CORRECTED COLUMNS
-- Fixed to use correct payment_transactions columns
-- ========================================

-- STEP 1: Drop and recreate with correct column names
DROP FUNCTION IF EXISTS handle_successful_payment CASCADE;

-- STEP 2: Reference generation function
CREATE OR REPLACE FUNCTION generate_payment_reference()
RETURNS TEXT AS $$
BEGIN
  RETURN 'txn_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || gen_random_uuid()::text;
END;
$$ LANGUAGE plpgsql;

-- STEP 3: Update Orders Table for Reference Consistency
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS paystack_reference TEXT,
ADD COLUMN IF NOT EXISTS reference_updated_at TIMESTAMPTZ DEFAULT NOW();

-- STEP 4: Create NEW handle_successful_payment function with CORRECT columns
CREATE OR REPLACE FUNCTION handle_successful_payment(
  p_paystack_reference TEXT,
  p_order_reference TEXT DEFAULT NULL,
  p_amount DECIMAL DEFAULT 0,
  p_currency TEXT DEFAULT 'NGN',
  p_paystack_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSON AS $$
DECLARE
  v_order_id UUID;
  v_payment_transaction_id UUID;
  v_result JSON;
BEGIN
  RAISE NOTICE 'Processing payment: paystack_ref=%, order_ref=%, amount=%', 
    p_paystack_reference, p_order_reference, p_amount;

  -- Find order by EITHER reference format
  SELECT id INTO v_order_id
  FROM orders 
  WHERE 
    payment_reference = p_order_reference 
    OR paystack_reference = p_paystack_reference
    OR payment_reference = p_paystack_reference
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
      provider_reference, 
      amount, 
      currency, 
      status, 
      gateway_response,
      created_at
    ) VALUES (
      p_paystack_reference,
      p_amount,
      p_currency,
      'orphaned',
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

  -- Create payment transaction record using CORRECT column names
  INSERT INTO payment_transactions (
    order_id,
    provider_reference,
    amount,
    currency,
    status,
    provider_response,
    paid_at,
    processed_at,
    created_at
  ) VALUES (
    v_order_id,
    p_paystack_reference,
    p_amount,
    p_currency,
    'paid',
    p_paystack_data,
    NOW(),
    NOW(),
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

  RAISE NOTICE 'Payment processed successfully: order_id=%, payment_id=%', 
    v_order_id, v_payment_transaction_id;

  RETURN json_build_object(
    'success', true,
    'order_id', v_order_id,
    'payment_transaction_id', v_payment_transaction_id,
    'paystack_reference', p_paystack_reference
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Payment processing error: %', SQLERRM;
    
    INSERT INTO payment_transactions (
      provider_reference, 
      amount, 
      currency, 
      status, 
      gateway_response,
      created_at
    ) VALUES (
      p_paystack_reference,
      p_amount,
      p_currency,
      'error',
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

-- STEP 5: Emergency Backfill Function with correct column names
CREATE OR REPLACE FUNCTION emergency_backfill_broken_orders()
RETURNS JSON AS $$
DECLARE
  v_fixed_count INTEGER := 0;
  v_order_record RECORD;
BEGIN
  FOR v_order_record IN
    SELECT DISTINCT o.id, o.payment_reference, o.total_amount
    FROM orders o
    WHERE 
      o.status = 'pending' 
      AND o.payment_status = 'pending'
      AND o.created_at > NOW() - INTERVAL '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM payment_transactions pt 
        WHERE pt.order_id = o.id OR pt.provider_reference = o.payment_reference
      )
  LOOP
    UPDATE orders 
    SET 
      status = 'requires_review',
      payment_status = 'verification_needed',
      updated_at = NOW()
    WHERE id = v_order_record.id;
    
    v_fixed_count := v_fixed_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'orders_marked_for_review', v_fixed_count,
    'message', 'Orders marked for manual payment verification'
  );
END;
$$ LANGUAGE plpgsql;

-- STEP 6: Production Monitoring Views
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

-- STEP 7: Alert Function
CREATE OR REPLACE FUNCTION check_payment_flow_health()
RETURNS JSON AS $$
DECLARE
  v_health RECORD;
  v_alerts JSON[];
BEGIN
  SELECT * INTO v_health FROM payment_flow_health WHERE period = 'last_24h';
  
  v_alerts := ARRAY[]::JSON[];
  
  IF v_health.completion_rate_percent < 90 THEN
    v_alerts := v_alerts || json_build_object(
      'severity', 'critical',
      'message', 'Order completion rate below 90%: ' || v_health.completion_rate_percent || '%'
    );
  END IF;
  
  IF v_health.pending_orders > 10 THEN
    v_alerts := v_alerts || json_build_object(
      'severity', 'warning',
      'message', 'High number of pending orders: ' || v_health.pending_orders
    );
  END IF;
  
  RETURN json_build_object(
    'health_status', v_health,
    'alerts', v_alerts,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- STEP 8: Grant Permissions
GRANT EXECUTE ON FUNCTION handle_successful_payment TO anon, authenticated;
GRANT EXECUTE ON FUNCTION emergency_backfill_broken_orders TO authenticated;
GRANT EXECUTE ON FUNCTION check_payment_flow_health TO anon, authenticated;
GRANT SELECT ON payment_flow_health TO anon, authenticated;

-- STEP 9: Create Indexes with correct column names
CREATE INDEX IF NOT EXISTS idx_orders_paystack_reference ON orders(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created ON orders(payment_status, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_reference ON payment_transactions(provider_reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);