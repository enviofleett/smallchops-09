-- URGENT PRODUCTION FIX: Replace broken payment verification function
-- Issue: Functions trying to access 'updated_by_name' field that doesn't exist
-- The orders table has 'updated_by' not 'updated_by_name'

-- Drop and recreate the problematic payment verification function
DROP FUNCTION IF EXISTS verify_and_update_payment_status(text, text, numeric, jsonb);

-- Create corrected payment verification function
CREATE OR REPLACE FUNCTION public.verify_and_update_payment_status(
  payment_ref text, 
  new_status text, 
  payment_amount numeric DEFAULT NULL, 
  payment_gateway_response jsonb DEFAULT '{}'
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Update order status with CORRECT field name 'updated_by'
  UPDATE orders
  SET 
    status = CASE 
      WHEN new_status IS NOT NULL AND new_status != 'null' AND new_status != '' 
      THEN new_status::order_status 
      ELSE status 
    END,
    payment_status = 'paid'::payment_status,
    payment_verified_at = NOW(),
    updated_at = NOW(),
    updated_by = auth.uid()  -- FIXED: Use 'updated_by' not 'updated_by_name'
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
    'payment_status', v_order_record.payment_status,
    'fixed_field_error', true
  );

EXCEPTION WHEN OTHERS THEN
  -- Log the error
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'payment_verification_error_fixed',
    'Payment Processing',
    'Payment verification error (FIXED VERSION): ' || SQLERRM,
    jsonb_build_object(
      'reference', payment_ref,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    )
  );
  RAISE;
END;
$function$;