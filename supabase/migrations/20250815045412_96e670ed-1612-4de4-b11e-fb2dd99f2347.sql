-- Create a comprehensive payment verification function that handles everything atomically
CREATE OR REPLACE FUNCTION public.update_order_payment_status(
  payment_ref text,
  new_status text DEFAULT 'confirmed',
  payment_amount numeric DEFAULT NULL,
  payment_gateway_response jsonb DEFAULT NULL
) RETURNS TABLE(order_id uuid, order_number text, status text, payment_status text, total_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_order_id uuid;
BEGIN
  -- Find the order by payment reference (try multiple reference formats)
  SELECT o.id, o.order_number, o.status, o.payment_status, o.total_amount, o.customer_email
  INTO v_order_record
  FROM orders o
  WHERE o.payment_reference = payment_ref 
     OR o.paystack_reference = payment_ref
  LIMIT 1;

  -- If order not found, return empty result
  IF v_order_record.id IS NULL THEN
    RAISE NOTICE 'No order found for payment reference: %', payment_ref;
    RETURN;
  END IF;

  v_order_id := v_order_record.id;

  -- Check if payment already processed (idempotency)
  IF v_order_record.payment_status = 'paid' AND v_order_record.status = 'confirmed' THEN
    RAISE NOTICE 'Payment already processed for order: %', v_order_id;
    -- Return current order data
    RETURN QUERY 
    SELECT o.id, o.order_number, o.status, o.payment_status, o.total_amount
    FROM orders o
    WHERE o.id = v_order_id;
    RETURN;
  END IF;

  -- Update order status and payment status with explicit column references
  UPDATE orders 
  SET 
    status = new_status::order_status,
    payment_status = 'paid'::payment_status,
    paid_at = COALESCE(paid_at, NOW()),
    updated_at = NOW()
  WHERE id = v_order_id;

  -- Create or update payment transaction record
  INSERT INTO payment_transactions (
    order_id,
    provider_reference,
    amount,
    currency,
    status,
    provider_response,
    paid_at,
    processed_at
  ) VALUES (
    v_order_id,
    payment_ref,
    COALESCE(payment_amount, v_order_record.total_amount),
    'NGN',
    'paid',
    COALESCE(payment_gateway_response, '{}'),
    NOW(),
    NOW()
  )
  ON CONFLICT (provider_reference) 
  DO UPDATE SET 
    status = 'paid',
    amount = COALESCE(EXCLUDED.amount, payment_transactions.amount),
    processed_at = NOW(),
    provider_response = COALESCE(EXCLUDED.provider_response, payment_transactions.provider_response);

  -- Log the successful payment processing
  INSERT INTO audit_logs (
    action,
    category,
    message,
    entity_id,
    new_values
  ) VALUES (
    'payment_verified',
    'Payment Processing',
    'Payment successfully verified and order updated: ' || v_order_record.order_number,
    v_order_id,
    jsonb_build_object(
      'payment_reference', payment_ref,
      'amount', COALESCE(payment_amount, v_order_record.total_amount),
      'status', new_status
    )
  );

  -- Return updated order information
  RETURN QUERY 
  SELECT o.id, o.order_number, o.status, o.payment_status, o.total_amount
  FROM orders o
  WHERE o.id = v_order_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO audit_logs (
      action,
      category,
      message,
      entity_id,
      new_values
    ) VALUES (
      'payment_verification_failed',
      'Payment Processing',
      'Payment verification failed: ' || SQLERRM,
      v_order_id,
      jsonb_build_object(
        'payment_reference', payment_ref,
        'error', SQLERRM,
        'sqlstate', SQLSTATE
      )
    );
    
    -- Re-raise the exception
    RAISE;
END;
$$;