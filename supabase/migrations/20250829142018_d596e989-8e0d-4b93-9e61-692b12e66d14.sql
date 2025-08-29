-- Fix verify_and_update_payment_status RPC to handle enum casting properly
CREATE OR REPLACE FUNCTION public.verify_and_update_payment_status(
  payment_ref text, 
  new_status text DEFAULT 'confirmed', 
  payment_amount numeric DEFAULT NULL, 
  payment_gateway_response jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_record RECORD;
  v_effective_status order_status;
  v_payment_status payment_status;
  v_result jsonb;
BEGIN
  -- Validate and cast the status with proper error handling
  BEGIN
    v_effective_status := new_status::order_status;
  EXCEPTION WHEN invalid_text_representation THEN
    -- Default to confirmed if invalid status provided
    v_effective_status := 'confirmed'::order_status;
  END;
  
  -- Set payment status based on order status  
  CASE v_effective_status
    WHEN 'confirmed' THEN v_payment_status := 'paid'::payment_status;
    WHEN 'pending' THEN v_payment_status := 'pending'::payment_status;
    ELSE v_payment_status := 'pending'::payment_status;
  END CASE;

  -- Find and update the order
  SELECT * INTO v_order_record
  FROM orders 
  WHERE payment_reference = payment_ref;
  
  IF NOT FOUND THEN
    -- Return error result
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found with payment reference: ' || payment_ref
    );
  END IF;
  
  -- Check if already processed
  IF v_order_record.status = 'confirmed' AND v_order_record.payment_status = 'paid' THEN
    -- Return already processed result
    RETURN jsonb_build_object(
      'success', true,
      'order_id', v_order_record.id,
      'order_number', v_order_record.order_number,
      'message', 'Payment already processed'
    );
  END IF;
  
  -- Update the order
  UPDATE orders 
  SET 
    status = v_effective_status,
    payment_status = v_payment_status,
    total_amount = COALESCE(payment_amount, total_amount),
    updated_at = NOW()
  WHERE id = v_order_record.id;
  
  -- Create payment transaction record if provided
  IF payment_gateway_response IS NOT NULL THEN
    INSERT INTO payment_transactions (
      order_id,
      payment_method,
      provider_reference,
      amount,
      currency,
      status,
      provider_response,
      customer_email,
      created_at
    ) VALUES (
      v_order_record.id,
      'paystack',
      payment_ref,
      COALESCE(payment_amount, v_order_record.total_amount),
      'NGN',
      'completed',
      payment_gateway_response,
      v_order_record.customer_email,
      NOW()
    )
    ON CONFLICT (provider_reference) DO UPDATE SET
      status = 'completed',
      provider_response = EXCLUDED.provider_response,
      updated_at = NOW();
  END IF;
  
  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_record.id,
    'order_number', v_order_record.order_number,
    'status', v_effective_status,
    'payment_status', v_payment_status,
    'total_amount', COALESCE(payment_amount, v_order_record.total_amount)
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log and return error
  INSERT INTO audit_logs (
    action, category, message, new_values
  ) VALUES (
    'verify_payment_status_error',
    'Payment Processing', 
    'Error in verify_and_update_payment_status: ' || SQLERRM,
    jsonb_build_object(
      'payment_ref', payment_ref,
      'new_status', new_status,
      'error', SQLERRM
    )
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Payment processing failed: ' || SQLERRM
  );
END;
$function$;