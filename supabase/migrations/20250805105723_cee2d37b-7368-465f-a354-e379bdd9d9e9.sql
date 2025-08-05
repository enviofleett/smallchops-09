-- Fix nested aggregate function issue in debug functions

-- Drop and recreate debug_payment_transaction_insert function without nested aggregates
DROP FUNCTION IF EXISTS public.debug_payment_transaction_insert(text, text, numeric, text, text, text, text);

CREATE OR REPLACE FUNCTION public.debug_payment_transaction_insert(
  p_order_id text,
  p_customer_email text,
  p_amount numeric,
  p_currency text DEFAULT 'NGN'::text,
  p_payment_method text DEFAULT 'paystack'::text,
  p_transaction_type text DEFAULT 'charge'::text,
  p_status text DEFAULT 'pending'::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id uuid;
  v_order_uuid uuid;
BEGIN
  -- Validate and cast UUID
  BEGIN
    v_order_uuid := p_order_id::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'invalid_uuid_format',
        'field', 'order_id',
        'message', 'order_id must be a valid UUID format',
        'provided_value', p_order_id
      );
  END;
  
  -- Validate input parameters
  IF p_order_id IS NULL OR LENGTH(TRIM(p_order_id)) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'validation_error',
      'field', 'order_id',
      'message', 'order_id cannot be null or empty'
    );
  END IF;
  
  IF p_customer_email IS NULL OR LENGTH(TRIM(p_customer_email)) = 0 OR p_customer_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'validation_error',
      'field', 'customer_email',
      'message', 'customer_email must be a valid email address'
    );
  END IF;
  
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'validation_error',
      'field', 'amount',
      'message', 'amount must be greater than 0'
    );
  END IF;
  
  -- Check if status and transaction_type are valid
  IF p_status NOT IN ('pending', 'completed', 'failed', 'refunded') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'validation_error',
      'field', 'status',
      'message', 'status must be one of: pending, completed, failed, refunded'
    );
  END IF;
  
  IF p_transaction_type NOT IN ('charge', 'refund', 'partial_refund') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'validation_error',
      'field', 'transaction_type',
      'message', 'transaction_type must be one of: charge, refund, partial_refund'
    );
  END IF;
  
  -- Simple insert without any aggregate functions
  BEGIN
    INSERT INTO payment_transactions (
      order_id,
      customer_email,
      amount,
      currency,
      payment_method,
      transaction_type,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_order_uuid,
      p_customer_email,
      p_amount,
      p_currency,
      p_payment_method,
      p_transaction_type,
      p_status,
      NOW(),
      NOW()
    ) RETURNING id INTO v_transaction_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'transaction_id', v_transaction_id,
      'message', 'Payment transaction created successfully'
    );
    
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'database_error',
      'sqlstate', SQLSTATE,
      'sqlerrm', SQLERRM,
      'message', 'Unexpected database error occurred'
    );
  END;
END;
$$;

-- Drop and recreate minimal_payment_test_insert function without nested aggregates
DROP FUNCTION IF EXISTS public.minimal_payment_test_insert(text, numeric);

CREATE OR REPLACE FUNCTION public.minimal_payment_test_insert(
  p_order_id text,
  p_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id uuid;
  v_order_uuid uuid;
BEGIN
  -- Validate and cast UUID
  BEGIN
    v_order_uuid := p_order_id::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'invalid_uuid_format',
        'message', 'order_id must be a valid UUID format',
        'provided_value', p_order_id,
        'hint', 'This was a minimal insert test - invalid UUID format provided'
      );
  END;
  
  -- Simple insert without any aggregate functions
  BEGIN
    INSERT INTO payment_transactions (
      order_id,
      amount,
      currency,
      status,
      payment_method,
      transaction_type
    ) VALUES (
      v_order_uuid,
      p_amount,
      'NGN',
      'pending',
      'paystack',
      'charge'
    ) RETURNING id INTO v_transaction_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'transaction_id', v_transaction_id,
      'message', 'Minimal insert successful'
    );
    
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLSTATE,
      'message', SQLERRM,
      'hint', 'This was a minimal insert test - if this fails, there may be required fields missing or constraint issues'
    );
  END;
END;
$$;