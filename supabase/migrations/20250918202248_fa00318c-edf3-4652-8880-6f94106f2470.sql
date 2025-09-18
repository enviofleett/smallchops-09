-- PHASE 2: Security Hardening - Fix remaining security vulnerabilities

-- Fix all functions missing search_path
CREATE OR REPLACE FUNCTION public.verify_and_update_payment_status(payment_ref text, new_status text, payment_amount numeric DEFAULT NULL::numeric, payment_gateway_response jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Find and lock the order
  SELECT * INTO v_order_record
  FROM orders
  WHERE payment_reference = payment_ref
  FOR UPDATE;

  IF NOT FOUND THEN
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

-- Fix update_order_status function
CREATE OR REPLACE FUNCTION public.update_order_status(order_id uuid, new_order_status text, new_payment_status text, payment_data jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  valid_order_statuses TEXT[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
  valid_payment_statuses TEXT[] := ARRAY['pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded', 'partially_paid'];
BEGIN
  -- Validate inputs and reject null/empty values
  IF order_id IS NULL THEN
    RAISE EXCEPTION 'Order ID cannot be null';
  END IF;
  
  IF new_order_status IS NULL OR new_order_status = '' OR new_order_status = 'null' THEN
    RAISE EXCEPTION 'Order status cannot be null or empty';
  END IF;
  
  IF new_payment_status IS NULL OR new_payment_status = '' OR new_payment_status = 'null' THEN
    RAISE EXCEPTION 'Payment status cannot be null or empty';
  END IF;
  
  -- Validate enum values
  IF NOT (new_order_status = ANY(valid_order_statuses)) THEN
    RAISE EXCEPTION 'Invalid order status: %. Valid values: %', new_order_status, array_to_string(valid_order_statuses, ', ');
  END IF;
  
  IF NOT (new_payment_status = ANY(valid_payment_statuses)) THEN
    RAISE EXCEPTION 'Invalid payment status: %. Valid values: %', new_payment_status, array_to_string(valid_payment_statuses, ', ');
  END IF;
  
  -- Update WITHOUT the payment_data column that doesn't exist
  UPDATE orders SET
    status = new_order_status::order_status,
    payment_status = new_payment_status::payment_status,
    payment_verified_at = NOW(),
    updated_at = NOW()
  WHERE id = order_id;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found with ID: %', order_id;
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;