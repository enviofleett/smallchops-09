-- Create enhanced payment recovery functions
CREATE OR REPLACE FUNCTION recover_stuck_payment(p_order_number text, p_paystack_reference text)
RETURNS jsonb AS $$
DECLARE
  v_order_id uuid;
  v_existing_tx_id uuid;
  v_result jsonb;
BEGIN
  -- Get order details
  SELECT id INTO v_order_id
  FROM orders
  WHERE order_number = p_order_number;
  
  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- Check if payment transaction already exists
  SELECT id INTO v_existing_tx_id
  FROM payment_transactions
  WHERE provider_reference = p_paystack_reference;
  
  IF v_existing_tx_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment transaction already exists'
    );
  END IF;
  
  -- Create payment transaction record for successful payment
  INSERT INTO payment_transactions (
    order_id,
    provider_reference,
    amount,
    currency,
    status,
    channel,
    customer_email,
    paid_at,
    metadata,
    created_at,
    updated_at
  )
  SELECT 
    v_order_id,
    p_paystack_reference,
    o.total_amount,
    'NGN',
    'paid',
    'online',
    o.customer_email,
    NOW(),
    jsonb_build_object(
      'recovery_fix', true,
      'recovery_timestamp', NOW()
    ),
    NOW(),
    NOW()
  FROM orders o
  WHERE o.id = v_order_id;
  
  -- Update order status
  UPDATE orders
  SET 
    payment_status = 'paid',
    status = 'confirmed',
    paid_at = NOW(),
    payment_reference = p_paystack_reference,
    updated_at = NOW()
  WHERE id = v_order_id;
  
  -- Log the recovery
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'payment_recovery_applied',
    'Payment Recovery',
    'Manual payment recovery for order: ' || p_order_number,
    jsonb_build_object(
      'order_id', v_order_id,
      'order_number', p_order_number,
      'paystack_reference', p_paystack_reference
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Payment recovered successfully',
    'order_id', v_order_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to sync payments with Paystack
CREATE OR REPLACE FUNCTION sync_pending_payments()
RETURNS jsonb AS $$
DECLARE
  v_pending_orders RECORD;
  v_sync_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_results jsonb := '[]'::jsonb;
BEGIN
  -- Process orders pending for more than 10 minutes
  FOR v_pending_orders IN
    SELECT id, order_number, payment_reference, total_amount, customer_email
    FROM orders
    WHERE payment_status = 'pending'
      AND payment_reference IS NOT NULL
      AND created_at < NOW() - INTERVAL '10 minutes'
      AND created_at > NOW() - INTERVAL '24 hours'
  LOOP
    BEGIN
      -- Check if payment transaction exists
      IF NOT EXISTS (
        SELECT 1 FROM payment_transactions 
        WHERE provider_reference = v_pending_orders.payment_reference
      ) THEN
        -- Log that we need external verification
        v_results := v_results || jsonb_build_object(
          'order_number', v_pending_orders.order_number,
          'status', 'needs_verification',
          'payment_reference', v_pending_orders.payment_reference
        );
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        v_results := v_results || jsonb_build_object(
          'order_number', v_pending_orders.order_number,
          'status', 'error',
          'error', SQLERRM
        );
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'processed', v_sync_count + v_error_count,
    'synced', v_sync_count,
    'errors', v_error_count,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply emergency fix for the specific test transaction
SELECT recover_stuck_payment('ORD-20250811-8222', 'txn_1754906935502_dda21f55-7931-4bd3-b012-180c53e398d2');