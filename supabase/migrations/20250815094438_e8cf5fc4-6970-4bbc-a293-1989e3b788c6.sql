-- Continue with the comprehensive payment solution

-- Function to generate payment references
CREATE OR REPLACE FUNCTION public.generate_payment_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  timestamp_part TEXT;
  random_suffix TEXT;
BEGIN
  -- Use current timestamp in milliseconds
  timestamp_part := EXTRACT(EPOCH FROM NOW() * 1000)::BIGINT::TEXT;
  
  -- Generate random suffix (8 characters)
  random_suffix := substr(gen_random_uuid()::text, 1, 8);
  
  -- Return txn_timestamp_suffix format
  RETURN 'txn_' || timestamp_part || '_' || random_suffix;
END;
$$;

-- Function to create payment intent
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_order_id UUID,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'NGN'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reference TEXT;
  v_intent_id UUID;
  v_order_exists BOOLEAN;
BEGIN
  -- Check if order exists and is valid
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = p_order_id AND payment_status = 'pending') INTO v_order_exists;
  
  IF NOT v_order_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found or already paid'
    );
  END IF;
  
  -- Generate unique reference
  v_reference := generate_payment_reference();
  
  -- Create payment intent
  INSERT INTO payment_intents (order_id, reference, amount, currency)
  VALUES (p_order_id, v_reference, p_amount, p_currency)
  RETURNING id INTO v_intent_id;
  
  -- Update order with payment reference
  UPDATE orders 
  SET payment_reference = v_reference, updated_at = NOW()
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'intent_id', v_intent_id,
    'reference', v_reference,
    'amount', p_amount,
    'currency', p_currency
  );
END;
$$;

-- Migration function to normalize pay_* references to txn_*
CREATE OR REPLACE FUNCTION public.migrate_payment_references()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_count INTEGER := 0;
  v_record RECORD;
  v_new_reference TEXT;
BEGIN
  -- Update orders with pay_* references
  FOR v_record IN 
    SELECT id, payment_reference 
    FROM orders 
    WHERE payment_reference LIKE 'pay_%'
  LOOP
    -- Convert pay_timestamp_suffix to txn_timestamp_suffix
    v_new_reference := 'txn_' || substring(v_record.payment_reference from 5);
    
    UPDATE orders 
    SET payment_reference = v_new_reference,
        updated_at = NOW()
    WHERE id = v_record.id;
    
    v_updated_count := v_updated_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_orders', v_updated_count,
    'message', 'Successfully migrated ' || v_updated_count || ' payment references from pay_* to txn_* format'
  );
END;
$$;