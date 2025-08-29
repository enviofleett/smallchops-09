
-- 1) Remove the ambiguous overload that starts with new_status
DROP FUNCTION IF EXISTS public.verify_and_update_payment_status(
  new_status text, 
  payment_amount numeric, 
  payment_gateway_response jsonb, 
  payment_ref text
);

-- 2) Create a single canonical function signature used by the Edge functions
CREATE OR REPLACE FUNCTION public.verify_and_update_payment_status(
  payment_ref text, 
  new_status text DEFAULT 'confirmed', 
  payment_amount numeric DEFAULT NULL, 
  payment_gateway_response jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_ref text := payment_ref;
  v_order RECORD;
  v_amount numeric;
  v_amount_match boolean := false;
  v_effective_status text := NULLIF(new_status, '');
BEGIN
  -- Allow only service role (Edge functions) or admins
  IF NOT (auth.role() = 'service_role' OR is_admin()) THEN
    RAISE EXCEPTION 'Access denied: only service role or admin can finalize payments';
  END IF;

  IF v_ref IS NULL OR length(trim(v_ref)) = 0 THEN
    RAISE EXCEPTION 'payment_ref is required';
  END IF;

  -- Normalize legacy references pay_ -> txn_
  IF v_ref LIKE 'pay_%' THEN
    v_ref := public.migrate_pay_to_txn_reference(v_ref);
  END IF;

  -- Locate order via payment_transactions first (most reliable), then orders
  SELECT o.*
  INTO v_order
  FROM payment_transactions pt
  JOIN orders o ON o.id = pt.order_id
  WHERE pt.reference = v_ref
  ORDER BY pt.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT *
    INTO v_order
    FROM orders
    WHERE payment_reference = v_ref
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;

  IF v_order.id IS NULL THEN
    INSERT INTO payment_processing_logs (order_id, payment_reference, processing_stage, error_message, metadata)
    VALUES (NULL, v_ref, 'verify_and_update_payment_status', 'Order not found for reference', jsonb_build_object('reference', v_ref));

    RETURN jsonb_build_object('success', false, 'error', 'Order not found for reference');
  END IF;

  -- Compute payment amount from param or Paystack data (kobo->naira)
  v_amount := COALESCE(
    payment_amount,
    (payment_gateway_response->>'amount')::numeric / 100.0
  );

  -- Amount tolerance check (allow small rounding difference)
  IF v_amount IS NOT NULL AND v_order.total_amount IS NOT NULL THEN
    v_amount_match := abs(v_order.total_amount - v_amount) <= 1;
  ELSE
    v_amount_match := false;
  END IF;

  -- Default status
  IF v_effective_status IS NULL OR v_effective_status = '' THEN
    v_effective_status := 'confirmed';
  END IF;

  -- Idempotent order update
  UPDATE orders
  SET
    payment_status = 'paid',
    status = v_effective_status,
    paid_at = COALESCE(paid_at, now()),
    payment_reference = COALESCE(payment_reference, v_ref),
    updated_at = now()
  WHERE id = v_order.id;

  -- Log processing details
  INSERT INTO payment_processing_logs (order_id, payment_reference, processing_stage, metadata)
  VALUES (
    v_order.id,
    v_ref,
    'verify_and_update_payment_status',
    jsonb_build_object(
      'new_status', v_effective_status,
      'amount_param', payment_amount,
      'amount_calc', v_amount,
      'amount_match', v_amount_match
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'payment_reference', v_ref,
    'amount_match', v_amount_match,
    'new_order_status', v_effective_status
  );

EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO payment_processing_logs (order_id, payment_reference, processing_stage, error_message, metadata)
    VALUES (COALESCE(v_order.id, NULL), v_ref, 'verify_and_update_payment_status_error', SQLERRM, jsonb_build_object('code', SQLSTATE));

    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'code', SQLSTATE);
END;
$function$;

-- Optional: ensure the service role can execute (edge functions call with service key)
GRANT EXECUTE ON FUNCTION public.verify_and_update_payment_status(text, text, numeric, jsonb) TO service_role;
