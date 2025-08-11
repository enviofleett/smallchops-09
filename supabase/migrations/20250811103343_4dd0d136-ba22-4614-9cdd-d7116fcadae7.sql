-- Emergency Recovery: Fix test order ORD-20250811-8222
-- This creates the missing payment transaction and updates the order status

DO $$
DECLARE
  v_order_id uuid;
  v_existing_tx_id uuid;
BEGIN
  -- Get the order ID for ORD-20250811-8222
  SELECT id INTO v_order_id
  FROM orders
  WHERE order_number = 'ORD-20250811-8222';
  
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Order ORD-20250811-8222 not found';
  END IF;
  
  -- Check if payment transaction already exists
  SELECT id INTO v_existing_tx_id
  FROM payment_transactions
  WHERE provider_reference = 'txn_1754906935502_dda21f55-7931-4bd3-b012-180c53e398d2';
  
  IF v_existing_tx_id IS NOT NULL THEN
    RAISE NOTICE 'Payment transaction already exists with ID: %', v_existing_tx_id;
  ELSE
    -- Create the missing payment transaction
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
    ) VALUES (
      v_order_id,
      'txn_1754906935502_dda21f55-7931-4bd3-b012-180c53e398d2',
      1500.00, -- ₦1,500 test amount
      'NGN',
      'paid',
      'online',
      'test@example.com',
      '2025-01-11 09:55:35+00',
      jsonb_build_object(
        'recovery_fix', true,
        'recovery_timestamp', NOW(),
        'original_issue', 'Missing payment transaction record',
        'test_transaction', true
      ),
      '2025-01-11 09:55:35+00',
      NOW()
    );
    
    RAISE NOTICE 'Created payment transaction for reference: txn_1754906935502_dda21f55-7931-4bd3-b012-180c53e398d2';
  END IF;
  
  -- Update the order status regardless
  UPDATE orders
  SET 
    payment_status = 'paid',
    status = 'confirmed',
    paid_at = '2025-01-11 09:55:35+00',
    payment_reference = 'txn_1754906935502_dda21f55-7931-4bd3-b012-180c53e398d2',
    updated_at = NOW()
  WHERE id = v_order_id;
  
  RAISE NOTICE 'Updated order ORD-20250811-8222 to paid/confirmed status';
  
  -- Log the recovery action
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'emergency_payment_recovery',
    'Payment Recovery',
    'Emergency fix applied for test order ORD-20250811-8222',
    jsonb_build_object(
      'order_id', v_order_id,
      'order_number', 'ORD-20250811-8222',
      'payment_reference', 'txn_1754906935502_dda21f55-7931-4bd3-b012-180c53e398d2',
      'recovery_method', 'manual_migration',
      'completion_rate_before', '4.35%'
    )
  );
  
  RAISE NOTICE 'Emergency recovery completed for order ORD-20250811-8222';
END $$;