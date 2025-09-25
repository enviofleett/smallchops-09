-- ========================================
-- ENHANCED PAYMENT VERIFICATION SECURITY
-- Implements secure rate limiting, enhanced payment processing, and audit trails
-- ========================================

-- Enhanced rate limiting function with better collision handling
CREATE OR REPLACE FUNCTION public.check_rate_limit_secure(
  p_identifier text,
  p_limit_type text,
  p_max_requests integer,
  p_window_minutes integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  window_start timestamp;
  current_count integer;
  reset_time timestamp;
BEGIN
  -- Calculate window start time
  window_start := date_trunc('minute', now()) - (p_window_minutes - 1) * interval '1 minute';
  reset_time := window_start + p_window_minutes * interval '1 minute';
  
  -- Get current request count in window
  SELECT COALESCE(COUNT(*), 0) INTO current_count
  FROM api_rate_limits
  WHERE identifier = p_identifier
    AND endpoint = p_limit_type
    AND window_start >= window_start;
  
  -- Clean up old records (older than 24 hours)
  DELETE FROM api_rate_limits 
  WHERE window_start < now() - interval '24 hours';
  
  -- Check if limit exceeded
  IF current_count >= p_max_requests THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current_count', current_count,
      'limit', p_max_requests,
      'reset_time', reset_time,
      'retry_after_seconds', EXTRACT(EPOCH FROM (reset_time - now()))::integer
    );
  END IF;
  
  -- Record this request
  INSERT INTO api_rate_limits (identifier, endpoint, request_count, window_start)
  VALUES (p_identifier, p_limit_type, 1, date_trunc('minute', now()))
  ON CONFLICT (identifier, endpoint, window_start) 
  DO UPDATE SET request_count = api_rate_limits.request_count + 1;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'current_count', current_count + 1,
    'limit', p_max_requests,
    'remaining', p_max_requests - current_count - 1,
    'reset_time', reset_time
  );
END;
$function$;

-- Enhanced payment processing function with security context
CREATE OR REPLACE FUNCTION public.verify_and_update_payment_status_enhanced(
  payment_ref text,
  new_status text,
  payment_amount numeric,
  payment_gateway_response jsonb,
  processing_context jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_transaction_id uuid;
  v_processing_start timestamp := now();
  v_user_id uuid := (processing_context->>'user_id')::uuid;
  v_ip_address text := processing_context->>'ip_address';
  v_user_agent text := processing_context->>'user_agent';
BEGIN
  -- Enhanced logging
  INSERT INTO audit_logs (
    action, category, message, user_id, ip_address, user_agent, new_values
  ) VALUES (
    'payment_verification_started',
    'Payment Processing',
    'Enhanced payment verification started',
    v_user_id,
    v_ip_address,
    v_user_agent,
    jsonb_build_object(
      'reference', payment_ref,
      'amount', payment_amount,
      'processing_context', processing_context
    )
  );

  -- Find order by payment reference with row locking
  SELECT * INTO v_order
  FROM orders
  WHERE payment_reference = payment_ref
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Log order not found
    INSERT INTO audit_logs (
      action, category, message, user_id, ip_address, user_agent, new_values
    ) VALUES (
      'payment_verification_order_not_found',
      'Payment Error',
      'Order not found for payment reference',
      v_user_id,
      v_ip_address,
      v_user_agent,
      jsonb_build_object('reference', payment_ref)
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found for reference: ' || payment_ref
    );
  END IF;

  -- Check if already processed (prevent double processing)
  IF v_order.status = 'confirmed' AND v_order.payment_status = 'paid' THEN
    -- Log duplicate processing attempt
    INSERT INTO audit_logs (
      action, category, message, user_id, entity_id, ip_address, user_agent, new_values
    ) VALUES (
      'payment_verification_duplicate',
      'Payment Warning',
      'Duplicate payment processing attempt',
      v_user_id,
      v_order.id,
      v_ip_address,
      v_user_agent,
      jsonb_build_object(
        'reference', payment_ref,
        'existing_status', v_order.status,
        'existing_payment_status', v_order.payment_status
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Payment already processed',
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'status', v_order.status,
      'payment_status', v_order.payment_status,
      'duplicate', true
    );
  END IF;

  -- Validate payment amount matches order total (with small tolerance for fees)
  IF ABS(v_order.total_amount - payment_amount) > 1.00 THEN
    INSERT INTO audit_logs (
      action, category, message, user_id, entity_id, ip_address, user_agent, new_values
    ) VALUES (
      'payment_verification_amount_mismatch',
      'Payment Security',
      'Payment amount mismatch detected',
      v_user_id,
      v_order.id,
      v_ip_address,
      v_user_agent,
      jsonb_build_object(
        'reference', payment_ref,
        'order_amount', v_order.total_amount,
        'payment_amount', payment_amount,
        'difference', ABS(v_order.total_amount - payment_amount)
      )
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment amount mismatch',
      'order_amount', v_order.total_amount,
      'payment_amount', payment_amount
    );
  END IF;

  -- Create payment transaction record
  INSERT INTO payment_transactions (
    order_id,
    reference,
    provider,
    amount,
    currency,
    status,
    provider_response,
    channel,
    paid_at,
    fees,
    customer_email,
    created_at,
    updated_at
  ) VALUES (
    v_order.id,
    payment_ref,
    'paystack',
    payment_amount,
    'NGN',
    'success',
    payment_gateway_response,
    payment_gateway_response->>'channel',
    (payment_gateway_response->>'paid_at')::timestamp,
    COALESCE((payment_gateway_response->>'fees')::numeric, 0),
    payment_gateway_response->'customer'->>'email',
    now(),
    now()
  ) RETURNING id INTO v_transaction_id;

  -- Update order status atomically
  UPDATE orders SET
    status = new_status::order_status,
    payment_status = 'paid',
    paid_at = (payment_gateway_response->>'paid_at')::timestamp,
    payment_method = payment_gateway_response->>'channel',
    payment_transaction_id = v_transaction_id,
    updated_at = now(),
    updated_by = v_user_id
  WHERE id = v_order.id;

  -- Log successful processing
  INSERT INTO audit_logs (
    action, category, message, user_id, entity_id, ip_address, user_agent, 
    old_values, new_values
  ) VALUES (
    'payment_verification_success',
    'Payment Processing',
    'Payment verification completed successfully',
    v_user_id,
    v_order.id,
    v_ip_address,
    v_user_agent,
    jsonb_build_object(
      'old_status', v_order.status,
      'old_payment_status', v_order.payment_status
    ),
    jsonb_build_object(
      'new_status', new_status,
      'new_payment_status', 'paid',
      'transaction_id', v_transaction_id,
      'amount', payment_amount,
      'processing_time_ms', EXTRACT(EPOCH FROM (now() - v_processing_start)) * 1000,
      'gateway_response', payment_gateway_response
    )
  );

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'status', new_status,
    'payment_status', 'paid',
    'transaction_id', v_transaction_id,
    'amount', payment_amount,
    'processing_time_ms', EXTRACT(EPOCH FROM (now() - v_processing_start)) * 1000
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Handle duplicate transaction
    INSERT INTO audit_logs (
      action, category, message, user_id, entity_id, ip_address, user_agent, new_values
    ) VALUES (
      'payment_verification_duplicate_transaction',
      'Payment Warning',
      'Duplicate transaction detected - payment may already be processed',
      v_user_id,
      v_order.id,
      v_ip_address,
      v_user_agent,
      jsonb_build_object(
        'reference', payment_ref,
        'error_code', SQLSTATE,
        'error_message', SQLERRM
      )
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Duplicate transaction detected',
      'duplicate', true,
      'order_id', v_order.id
    );

  WHEN OTHERS THEN
    -- Log critical error
    INSERT INTO audit_logs (
      action, category, message, user_id, entity_id, ip_address, user_agent, new_values
    ) VALUES (
      'payment_verification_critical_error',
      'Payment Critical',
      'Critical error in enhanced payment verification',
      v_user_id,
      COALESCE(v_order.id, NULL),
      v_ip_address,
      v_user_agent,
      jsonb_build_object(
        'reference', payment_ref,
        'amount', payment_amount,
        'error_code', SQLSTATE,
        'error_message', SQLERRM,
        'processing_time_ms', EXTRACT(EPOCH FROM (now() - v_processing_start)) * 1000
      )
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Critical processing error: ' || SQLERRM,
      'error_code', SQLSTATE
    );
END;
$function$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.check_rate_limit_secure(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_and_update_payment_status_enhanced(text, text, numeric, jsonb, jsonb) TO service_role;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_lookup 
ON api_rate_limits (identifier, endpoint, window_start);

CREATE INDEX IF NOT EXISTS idx_audit_logs_payment_verification 
ON audit_logs (action, created_at) 
WHERE action LIKE 'payment_verification%';