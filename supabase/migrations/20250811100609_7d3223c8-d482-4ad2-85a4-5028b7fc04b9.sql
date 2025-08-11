-- Fix the emergency backfill function to use valid order statuses
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
    -- Mark as cancelled instead of invalid status and add note
    UPDATE orders 
    SET 
      status = 'cancelled',
      payment_status = 'failed',
      updated_at = NOW(),
      delivery_notes = COALESCE(delivery_notes, '') || ' [EMERGENCY FIX: Missing payment transaction record]'
    WHERE id = v_order_record.id;
    
    v_fixed_count := v_fixed_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'orders_marked_for_review', v_fixed_count,
    'message', 'Orders marked as cancelled due to missing payment records'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix security warnings by setting search_path for functions
CREATE OR REPLACE FUNCTION generate_payment_reference()
RETURNS TEXT AS $$
BEGIN
  RETURN 'txn_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || gen_random_uuid()::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix the main RPC function security
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;