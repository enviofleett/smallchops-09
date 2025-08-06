-- Create the final production-ready handle_successful_payment function
CREATE OR REPLACE FUNCTION public.handle_successful_payment(
  p_reference text, 
  p_paid_at timestamp with time zone, 
  p_gateway_response text, 
  p_fees numeric, 
  p_channel text, 
  p_authorization_code text DEFAULT NULL::text, 
  p_card_type text DEFAULT NULL::text, 
  p_last4 text DEFAULT NULL::text, 
  p_exp_month text DEFAULT NULL::text, 
  p_exp_year text DEFAULT NULL::text, 
  p_bank text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_transaction_id uuid;
  v_order_id uuid;
  v_user_id uuid;
BEGIN
  -- Update payment transaction atomically
  UPDATE payment_transactions 
  SET 
    status = 'paid',
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
    processed_at = now()
  WHERE provider_reference = p_reference
  RETURNING id, order_id, (metadata->>'user_id')::uuid INTO v_transaction_id, v_order_id, v_user_id;

  -- If no transaction found, raise exception
  IF v_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Transaction with reference % not found', p_reference;
  END IF;

  -- PRODUCTION READY: Update order status to confirmed when payment is successful
  IF v_order_id IS NOT NULL THEN
    UPDATE orders 
    SET 
      payment_status = 'paid',
      status = 'confirmed',  -- Automatically confirm order when payment succeeds
      updated_at = now()
    WHERE id = v_order_id;
  END IF;

  -- Save payment method if authorization provided and user exists
  IF p_authorization_code IS NOT NULL AND v_user_id IS NOT NULL THEN
    INSERT INTO saved_payment_methods (
      user_id,
      provider,
      authorization_code,
      card_type,
      last4,
      exp_month,
      exp_year,
      bank,
      is_active
    ) VALUES (
      v_user_id,
      'paystack',
      p_authorization_code,
      p_card_type,
      p_last4,
      p_exp_month,
      p_exp_year,
      p_bank,
      true
    ) ON CONFLICT (authorization_code) DO UPDATE SET
      is_active = true,
      updated_at = now();
  END IF;
  
  -- Log successful payment processing for audit trail
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'payment_processed_and_order_confirmed',
    'Payment Processing',
    'Payment processed successfully and order confirmed for reference: ' || p_reference,
    jsonb_build_object(
      'transaction_id', v_transaction_id,
      'order_id', v_order_id,
      'reference', p_reference,
      'fees', p_fees,
      'channel', p_channel
    )
  );
END;
$function$;