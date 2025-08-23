-- Fix the order_status enum casting issue in process_payment_atomically function
CREATE OR REPLACE FUNCTION public.process_payment_atomically(p_payment_reference text, p_idempotency_key text, p_amount_kobo integer, p_status text DEFAULT 'confirmed'::text, p_webhook_event_id text DEFAULT NULL::text)
 RETURNS TABLE(order_id uuid, order_number text, previous_status text, new_status text, amount_verified boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_record RECORD;
  v_amount_match BOOLEAN := FALSE;
BEGIN
  -- Check if already processed by idempotency key
  SELECT * INTO v_order_record
  FROM orders o
  WHERE o.idempotency_key = p_idempotency_key
  LIMIT 1;
  
  IF FOUND AND v_order_record.status::text = p_status THEN
    -- Already processed, return existing result
    RETURN QUERY SELECT 
      v_order_record.id,
      v_order_record.order_number,
      v_order_record.status::TEXT,
      v_order_record.status::TEXT,
      TRUE;
    RETURN;
  END IF;

  -- Find order by payment reference
  SELECT * INTO v_order_record
  FROM orders o
  WHERE o.payment_reference = p_payment_reference
  FOR UPDATE; -- Prevent concurrent processing
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for payment reference: %', p_payment_reference;
  END IF;
  
  -- Verify amount if provided
  IF p_amount_kobo IS NOT NULL THEN
    v_amount_match := (v_order_record.amount_kobo = p_amount_kobo);
    IF NOT v_amount_match THEN
      RAISE EXCEPTION 'Amount mismatch. Expected: % kobo, Received: % kobo', 
        v_order_record.amount_kobo, p_amount_kobo;
    END IF;
  END IF;
  
  -- Update order atomically with proper enum casting
  UPDATE orders 
  SET 
    status = p_status::order_status,
    payment_status = CASE WHEN p_status = 'confirmed' THEN 'paid' ELSE payment_status END,
    idempotency_key = COALESCE(idempotency_key, p_idempotency_key),
    processing_lock = FALSE,
    paid_at = CASE WHEN p_status = 'confirmed' THEN NOW() ELSE paid_at END,
    updated_at = NOW()
  WHERE id = v_order_record.id;
  
  -- Create or update payment transaction
  INSERT INTO payment_transactions (
    order_id,
    provider_reference,
    amount,
    amount_kobo,
    currency,
    status,
    idempotency_key,
    webhook_event_id,
    last_webhook_at,
    customer_email,
    provider_response,
    created_at,
    updated_at
  ) VALUES (
    v_order_record.id,
    p_payment_reference,
    v_order_record.total_amount,
    v_order_record.amount_kobo,
    'NGN',
    CASE WHEN p_status = 'confirmed' THEN 'completed' ELSE 'failed' END,
    p_idempotency_key,
    p_webhook_event_id,
    CASE WHEN p_webhook_event_id IS NOT NULL THEN NOW() ELSE NULL END,
    v_order_record.customer_email,
    jsonb_build_object('processed_at', NOW(), 'status', p_status),
    NOW(),
    NOW()
  )
  ON CONFLICT (provider_reference) DO UPDATE SET
    status = EXCLUDED.status,
    idempotency_key = COALESCE(payment_transactions.idempotency_key, EXCLUDED.idempotency_key),
    webhook_event_id = COALESCE(EXCLUDED.webhook_event_id, payment_transactions.webhook_event_id),
    last_webhook_at = CASE WHEN EXCLUDED.webhook_event_id IS NOT NULL THEN NOW() ELSE payment_transactions.last_webhook_at END,
    provider_response = EXCLUDED.provider_response,
    updated_at = NOW();
  
  -- Return result
  RETURN QUERY SELECT 
    v_order_record.id,
    v_order_record.order_number,
    v_order_record.status::TEXT,
    p_status,
    COALESCE(v_amount_match, TRUE);
    
END;
$function$;