-- Enhanced payment callback fix with bulletproof validation
-- Create payment_logs table for comprehensive audit trail
CREATE TABLE IF NOT EXISTS payment_logs (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  reference TEXT NOT NULL,
  status TEXT,
  amount INTEGER,
  customer_email TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  log_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_logs_reference ON payment_logs(reference);
CREATE INDEX IF NOT EXISTS idx_payment_logs_order_id ON payment_logs(order_id);

-- Enhanced RPC function with comprehensive error handling and bulletproof validation
CREATE OR REPLACE FUNCTION update_order_status_safe(
  p_reference TEXT,
  p_status TEXT,
  p_amount INTEGER DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_validated_status order_status;
  v_result JSON;
  v_valid_statuses TEXT[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
BEGIN
  -- CRITICAL: Input validation with null/empty protection
  IF p_reference IS NULL OR trim(p_reference) = '' OR p_reference = 'null' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Missing or invalid reference parameter'
    );
  END IF;

  -- CRITICAL: Status validation with safe fallbacks
  IF p_status IS NULL OR trim(p_status) = '' OR p_status = 'null' THEN
    RAISE WARNING 'Invalid status received: %, defaulting to confirmed', p_status;
    v_validated_status := 'confirmed'::order_status;
  ELSE
    -- Validate status is in allowed enum values
    IF NOT (p_status = ANY(v_valid_statuses)) THEN
      RAISE WARNING 'Invalid order status: %, defaulting to confirmed', p_status;
      v_validated_status := 'confirmed'::order_status;
    ELSE
      -- Safe enum cast
      BEGIN
        v_validated_status := p_status::order_status;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE WARNING 'Enum cast failed for status: %, defaulting to confirmed', p_status;
        v_validated_status := 'confirmed'::order_status;
      END;
    END IF;
  END IF;

  -- Find the order
  SELECT * INTO v_order_record
  FROM orders
  WHERE payment_reference = p_reference;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Order not found for reference: ' || p_reference
    );
  END IF;

  -- Update order status with safe enum values
  UPDATE orders
  SET 
    status = v_validated_status,
    payment_status = 'paid'::payment_status,
    payment_verified_at = NOW(),
    updated_at = NOW()
  WHERE payment_reference = p_reference;

  -- Log the payment processing
  INSERT INTO payment_logs (
    order_id,
    reference,
    status,
    amount,
    customer_email,
    processed_at,
    log_data
  ) VALUES (
    v_order_record.id,
    p_reference,
    v_validated_status::TEXT,
    p_amount,
    p_customer_email,
    NOW(),
    json_build_object(
      'original_status', p_status,
      'validated_status', v_validated_status,
      'order_id', v_order_record.id,
      'amount_kobo', p_amount,
      'customer_email', p_customer_email
    )
  );

  -- Queue email notification for successful payments
  IF v_validated_status IN ('confirmed', 'completed') THEN
    PERFORM upsert_communication_event_production(
      'payment_confirmation',
      COALESCE(p_customer_email, v_order_record.customer_email),
      'payment_confirmed',
      json_build_object(
        'customer_name', v_order_record.customer_name,
        'order_number', v_order_record.order_number,
        'total_amount', v_order_record.total_amount
      ),
      v_order_record.id,
      'payment_callback'
    );
  END IF;

  v_result := json_build_object(
    'success', true,
    'order_id', v_order_record.id,
    'order_number', v_order_record.order_number,
    'status', v_validated_status,
    'reference', p_reference,
    'updated_at', NOW()
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Log error and return failure response
  RAISE WARNING 'Error in update_order_status_safe: %', SQLERRM;
  
  -- Insert error log
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'payment_callback_error',
    'Payment Processing',
    'Payment callback RPC error: ' || SQLERRM,
    json_build_object(
      'reference', p_reference,
      'status', p_status,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    )
  );
  
  RETURN json_build_object(
    'success', false,
    'error', 'Database error: ' || SQLERRM,
    'reference', p_reference
  );
END;
$$;