-- Drop and recreate the verify_and_update_payment_status function
DROP FUNCTION IF EXISTS public.verify_and_update_payment_status(text,text,numeric,jsonb);

-- Create verify_and_update_payment_status function for the verify-payment edge function
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
BEGIN
  -- Find and lock the order
  SELECT * INTO v_order_record
  FROM orders
  WHERE payment_reference = payment_ref
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for reference: %', payment_ref;
  END IF;

  -- Update order status
  UPDATE orders
  SET 
    status = new_status::order_status,
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

  -- Return success result
  SELECT id, order_number, status, payment_status
  INTO v_order_record
  FROM orders
  WHERE payment_reference = payment_ref;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_record.id,
    'order_number', v_order_record.order_number,
    'status', v_order_record.status,
    'payment_status', v_order_record.payment_status
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

-- Create the process_payment_atomically function for secure webhook processing
CREATE OR REPLACE FUNCTION public.process_payment_atomically(
  p_reference text,
  p_status text,
  p_amount_kobo integer,
  p_gateway_response jsonb DEFAULT '{}',
  p_paid_at text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_result jsonb;
BEGIN
  -- Find the order by payment reference
  SELECT * INTO v_order_record
  FROM orders
  WHERE payment_reference = p_reference;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for reference: %', p_reference;
  END IF;

  -- Update order status based on payment status
  IF p_status = 'paid' THEN
    UPDATE orders
    SET 
      status = 'confirmed'::order_status,
      payment_status = 'paid'::payment_status,
      payment_verified_at = NOW(),
      updated_at = NOW()
    WHERE payment_reference = p_reference;
    
    -- Create or update payment transaction record
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
      p_reference,
      p_reference,
      v_order_record.id,
      COALESCE(p_amount_kobo / 100.0, v_order_record.total_amount),
      p_amount_kobo,
      'NGN',
      'completed',
      'paystack',
      v_order_record.customer_email,
      p_gateway_response,
      CASE WHEN p_paid_at IS NOT NULL THEN p_paid_at::timestamp with time zone ELSE NOW() END,
      NOW(),
      NOW()
    )
    ON CONFLICT (reference) 
    DO UPDATE SET
      amount_kobo = EXCLUDED.amount_kobo,
      gateway_response = EXCLUDED.gateway_response,
      paid_at = EXCLUDED.paid_at,
      status = EXCLUDED.status,
      updated_at = NOW();
    
  ELSIF p_status = 'failed' THEN
    UPDATE orders
    SET 
      payment_status = 'failed'::payment_status,
      updated_at = NOW()
    WHERE payment_reference = p_reference;
    
    -- Update payment transaction to failed
    UPDATE payment_transactions
    SET 
      status = 'failed',
      gateway_response = p_gateway_response,
      updated_at = NOW()
    WHERE reference = p_reference;
  END IF;

  -- Get updated order details
  SELECT id, order_number, status, payment_status
  INTO v_order_record
  FROM orders
  WHERE payment_reference = p_reference;

  v_result := jsonb_build_object(
    'success', true,
    'order_id', v_order_record.id,
    'order_number', v_order_record.order_number,
    'status', v_order_record.status,
    'payment_status', v_order_record.payment_status,
    'processed_at', NOW()
  );

  -- Log the processing
  INSERT INTO audit_logs (action, category, message, entity_id, new_values)
  VALUES (
    'payment_processed_atomically',
    'Payment Processing',
    'Payment processed via atomic webhook function',
    v_order_record.id,
    jsonb_build_object(
      'reference', p_reference,
      'status', p_status,
      'amount_kobo', p_amount_kobo
    )
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'payment_processing_failed',
    'Payment Processing Error',
    'Atomic payment processing failed: ' || SQLERRM,
    jsonb_build_object(
      'reference', p_reference,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    )
  );
  
  RAISE;
END;
$$;