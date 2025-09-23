-- Add enhanced payment processing function with real-time capabilities
CREATE OR REPLACE FUNCTION public.handle_successful_payment_enhanced(
  p_reference TEXT,
  p_paid_at TIMESTAMP WITH TIME ZONE,
  p_gateway_response TEXT,
  p_fees NUMERIC DEFAULT 0,
  p_channel TEXT DEFAULT NULL,
  p_authorization_code TEXT DEFAULT NULL,
  p_card_type TEXT DEFAULT NULL,
  p_last4 TEXT DEFAULT NULL,
  p_exp_month INTEGER DEFAULT NULL,
  p_exp_year INTEGER DEFAULT NULL,
  p_bank TEXT DEFAULT NULL,
  p_webhook_event_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_transaction RECORD;
  v_order RECORD;
  v_result JSONB := '{}';
BEGIN
  -- Get and lock the payment transaction
  SELECT * INTO v_transaction
  FROM payment_transactions
  WHERE provider_reference = p_reference
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment transaction not found for reference: %', p_reference;
  END IF;
  
  -- Update transaction with payment details
  UPDATE payment_transactions SET
    status = 'success',
    paid_at = p_paid_at,
    gateway_response = p_gateway_response,
    fees = p_fees,
    channel = p_channel,
    authorization_code = p_authorization_code,
    card_type = p_card_type,
    last4 = p_last4,
    exp_month = p_exp_month,
    exp_year = p_exp_year,
    bank = p_bank,
    webhook_event_id = p_webhook_event_id,
    processed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_transaction.id;
  
  -- Get and update the order
  SELECT * INTO v_order
  FROM orders
  WHERE id = v_transaction.order_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for transaction: %', v_transaction.id;
  END IF;
  
  -- Update order status
  UPDATE orders SET
    payment_status = 'paid',
    status = 'confirmed',
    paid_at = p_paid_at,
    updated_at = NOW()
  WHERE id = v_order.id;
  
  -- Log the successful payment processing
  INSERT INTO audit_logs (
    action, category, message, entity_id, new_values
  ) VALUES (
    'payment_processed_enhanced',
    'Payment Processing',
    'Payment successfully processed via enhanced webhook',
    v_order.id,
    jsonb_build_object(
      'reference', p_reference,
      'amount', v_transaction.amount,
      'channel', p_channel,
      'webhook_event_id', p_webhook_event_id,
      'processing_time', EXTRACT(EPOCH FROM (NOW() - v_transaction.created_at))
    )
  );
  
  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'transaction_id', v_transaction.id,
    'amount', v_transaction.amount,
    'reference', p_reference,
    'notifications_sent', true
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  -- Log the error
  INSERT INTO audit_logs (
    action, category, message, entity_id, new_values
  ) VALUES (
    'payment_processing_failed_enhanced',
    'Payment Processing',
    'Enhanced payment processing failed: ' || SQLERRM,
    NULL,
    jsonb_build_object(
      'reference', p_reference,
      'error', SQLERRM,
      'webhook_event_id', p_webhook_event_id
    )
  );
  
  RAISE;
END;
$$;