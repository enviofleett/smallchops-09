-- Fix payment verification function with proper parameter validation and enum handling
CREATE OR REPLACE FUNCTION public.verify_and_update_payment_status(
  payment_ref text,
  new_status text,
  payment_amount numeric DEFAULT NULL,
  payment_gateway_response jsonb DEFAULT '{}'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_result jsonb;
  v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'];
BEGIN
  -- CRITICAL: Parameter validation to prevent enum casting errors
  IF payment_ref IS NULL OR trim(payment_ref) = '' THEN
    RAISE EXCEPTION 'Payment reference cannot be null or empty';
  END IF;
  
  IF new_status IS NULL OR trim(new_status) = '' OR new_status = 'null' THEN
    RAISE EXCEPTION 'Status cannot be null or empty. Received: %', new_status;
  END IF;
  
  -- Validate enum value before casting
  IF NOT (new_status = ANY(v_valid_statuses)) THEN
    RAISE EXCEPTION 'Invalid order status: %. Valid values: %', new_status, array_to_string(v_valid_statuses, ', ');
  END IF;

  -- Log function call for debugging
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'verify_payment_function_called',
    'Payment Processing',
    'Payment verification function called',
    jsonb_build_object(
      'payment_ref', payment_ref,
      'new_status', new_status,
      'payment_amount', payment_amount
    )
  );

  -- Find and lock the order
  SELECT * INTO v_order_record
  FROM orders
  WHERE payment_reference = payment_ref
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Log missing order
    INSERT INTO audit_logs (action, category, message, new_values)
    VALUES (
      'payment_verification_order_not_found',
      'Payment Processing Error',
      'Order not found for payment reference',
      jsonb_build_object('payment_ref', payment_ref)
    );
    RAISE EXCEPTION 'Order not found for reference: %', payment_ref;
  END IF;

  -- Update order status with explicit enum casting and validation
  UPDATE orders
  SET 
    status = CASE 
      WHEN new_status IS NOT NULL AND new_status != 'null' AND new_status != '' 
      THEN new_status::order_status 
      ELSE status 
    END,
    payment_status = 'paid'::payment_status,
    payment_verified_at = NOW(),
    updated_at = NOW()
  WHERE payment_reference = payment_ref;

  -- Create or update payment transaction
  INSERT INTO payment_transactions (
    reference,
    provider_reference,
    order_id,
    amount,
    amount_kobo,
    currency,
    status,
    provider,
    customer_email,
    gateway_response,
    paid_at,
    created_at,
    updated_at
  ) VALUES (
    payment_ref,
    payment_ref,
    v_order_record.id,
    COALESCE(payment_amount, v_order_record.total_amount),
    COALESCE((payment_amount * 100)::integer, (v_order_record.total_amount * 100)::integer),
    'NGN',
    'completed',
    'paystack',
    v_order_record.customer_email,
    payment_gateway_response,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (reference) 
  DO UPDATE SET
    amount = EXCLUDED.amount,
    amount_kobo = EXCLUDED.amount_kobo,
    gateway_response = EXCLUDED.gateway_response,
    status = EXCLUDED.status,
    updated_at = NOW();

  -- Get updated order details
  SELECT id, order_number, status, payment_status
  INTO v_order_record
  FROM orders
  WHERE payment_reference = payment_ref;

  -- Log successful processing
  INSERT INTO audit_logs (action, category, message, entity_id, new_values)
  VALUES (
    'payment_verification_success',
    'Payment Processing',
    'Payment verified and order updated successfully',
    v_order_record.id,
    jsonb_build_object(
      'payment_ref', payment_ref,
      'order_id', v_order_record.id,
      'new_status', new_status,
      'final_status', v_order_record.status
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_record.id,
    'order_number', v_order_record.order_number,
    'status', v_order_record.status,
    'payment_status', v_order_record.payment_status
  );

EXCEPTION WHEN OTHERS THEN
  -- Enhanced error logging
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'payment_verification_error',
    'Payment Processing Error',
    'Payment verification failed: ' || SQLERRM,
    jsonb_build_object(
      'payment_ref', payment_ref,
      'new_status', new_status,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    )
  );
  
  RAISE;
END;
$$;