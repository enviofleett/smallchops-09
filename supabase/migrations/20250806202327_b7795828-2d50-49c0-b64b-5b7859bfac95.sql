-- Function to bulk update verified payment transactions to success status
CREATE OR REPLACE FUNCTION public.bulk_update_payment_status_to_success()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated_count INTEGER := 0;
  v_order_updated_count INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Update payment transactions from pending to success
  -- This assumes that payments that reached the verification stage should be successful
  UPDATE payment_transactions 
  SET 
    status = 'success',
    paid_at = NOW(),
    processed_at = NOW(),
    updated_at = NOW()
  WHERE status = 'pending'
  AND created_at >= NOW() - INTERVAL '24 hours' -- Only recent payments
  AND provider_reference IS NOT NULL; -- Only payments with valid references
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Update corresponding orders to paid status
  UPDATE orders 
  SET 
    payment_status = 'paid',
    status = 'confirmed',
    updated_at = NOW()
  WHERE payment_status = 'pending'
  AND id IN (
    SELECT DISTINCT order_id 
    FROM payment_transactions 
    WHERE status = 'success' 
    AND order_id IS NOT NULL
  );
  
  GET DIAGNOSTICS v_order_updated_count = ROW_COUNT;
  
  -- Log the operation
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'bulk_payment_status_update',
    'Payment Processing',
    'Bulk updated payment statuses from pending to success',
    jsonb_build_object(
      'payments_updated', v_updated_count,
      'orders_updated', v_order_updated_count,
      'timestamp', NOW()
    )
  );
  
  v_result := jsonb_build_object(
    'success', true,
    'payments_updated', v_updated_count,
    'orders_updated', v_order_updated_count,
    'message', 'Payment statuses updated successfully'
  );
  
  RETURN v_result;
END;
$function$;

-- Function to manually verify and update a specific payment
CREATE OR REPLACE FUNCTION public.manual_payment_verification(p_payment_reference text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_transaction_record RECORD;
  v_order_record RECORD;
  v_result JSONB;
BEGIN
  -- Get the payment transaction
  SELECT * INTO v_transaction_record
  FROM payment_transactions
  WHERE provider_reference = p_payment_reference;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment transaction not found',
      'reference', p_payment_reference
    );
  END IF;
  
  -- Update payment transaction to success
  UPDATE payment_transactions 
  SET 
    status = 'success',
    paid_at = NOW(),
    processed_at = NOW(),
    updated_at = NOW()
  WHERE provider_reference = p_payment_reference;
  
  -- Update corresponding order if exists
  IF v_transaction_record.order_id IS NOT NULL THEN
    UPDATE orders 
    SET 
      payment_status = 'paid',
      status = 'confirmed',
      updated_at = NOW()
    WHERE id = v_transaction_record.order_id;
    
    SELECT * INTO v_order_record FROM orders WHERE id = v_transaction_record.order_id;
  END IF;
  
  -- Log the manual verification
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'manual_payment_verification',
    'Payment Processing',
    'Manual payment verification for reference: ' || p_payment_reference,
    jsonb_build_object(
      'payment_reference', p_payment_reference,
      'transaction_id', v_transaction_record.id,
      'order_id', v_transaction_record.order_id,
      'amount', v_transaction_record.amount
    )
  );
  
  v_result := jsonb_build_object(
    'success', true,
    'payment_reference', p_payment_reference,
    'transaction_id', v_transaction_record.id,
    'order_id', v_transaction_record.order_id,
    'order_number', COALESCE(v_order_record.order_number, 'N/A'),
    'amount', v_transaction_record.amount,
    'message', 'Payment manually verified and updated'
  );
  
  RETURN v_result;
END;
$function$;