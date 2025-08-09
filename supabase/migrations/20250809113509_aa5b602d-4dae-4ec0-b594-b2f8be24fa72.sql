-- 1) Ensure index for paid_at exists (safe to run repeatedly)
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON public.orders(paid_at) WHERE paid_at IS NOT NULL;

-- 2) Update the production-safe payment handler to also set paid_at
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
    paid_at = COALESCE(p_paid_at, paid_at, now()),
    gateway_response = p_gateway_response,
    fees = p_fees,
    channel = p_channel,
    authorization_code = p_authorization_code,
    card_type = p_card_type,
    last4 = p_last4,
    exp_month = p_exp_month,
    exp_year = p_exp_year,
    bank = p_bank,
    processed_at = now(),
    updated_at = now()
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
      paid_at = COALESCE(orders.paid_at, p_paid_at, now()),
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
      'channel', p_channel,
      'paid_at', COALESCE(p_paid_at, now())
    )
  );
END;
$function$;

-- 3) Trigger: auto-populate paid_at when payment_status flips to 'paid'
CREATE OR REPLACE FUNCTION public.set_paid_at_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' 
     AND (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND NEW.payment_status = 'paid' THEN
    NEW.paid_at := COALESCE(NEW.paid_at, now());
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_paid_at_on_status_change ON public.orders;
CREATE TRIGGER trg_set_paid_at_on_status_change
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_paid_at_on_status_change();

-- 4) Backfill: set paid_at where payment_status is already 'paid'
-- Prefer transaction paid_at when available, else use current timestamp
UPDATE public.orders o
SET paid_at = COALESCE(o.paid_at, pt.paid_at, now()),
    updated_at = now()
FROM public.payment_transactions pt
WHERE o.payment_status = 'paid'
  AND o.paid_at IS NULL
  AND pt.provider_reference = o.payment_reference;

-- Catch any remaining paid orders without matching transactions
UPDATE public.orders o
SET paid_at = COALESCE(o.paid_at, now()),
    updated_at = now()
WHERE o.payment_status = 'paid'
  AND o.paid_at IS NULL;

-- 5) Optional targeted backfill for the two provided references (no-op if not found)
DO $$
DECLARE
  ref TEXT;
  refs TEXT[] := ARRAY['pay_1754730907804_704m4ph3o', 'pay_1754729858007_pe4zpafsq'];
  v_order RECORD;
BEGIN
  FOREACH ref IN ARRAY refs LOOP
    RAISE NOTICE 'Processing reference: %', ref;

    -- Find order by payment_reference
    SELECT id, total_amount INTO v_order
    FROM public.orders 
    WHERE payment_reference = ref
    LIMIT 1;

    IF FOUND THEN
      -- Ensure a transaction row exists (pending), then mark as paid via the handler
      INSERT INTO public.payment_transactions (
        provider_reference,
        transaction_type,
        amount,
        currency,
        status,
        order_id,
        created_at,
        updated_at
      ) VALUES (
        ref,
        'charge',
        v_order.total_amount,
        'NGN',
        'pending',
        v_order.id,
        now(),
        now()
      )
      ON CONFLICT (provider_reference) DO NOTHING;

      -- Confirm payment
      PERFORM public.handle_successful_payment(
        ref,
        now(),
        'Manual backfill confirmation',
        0,
        'manual_backfill',
        NULL, NULL, NULL, NULL, NULL, NULL
      );

      -- Ensure paid_at present
      UPDATE public.orders
      SET paid_at = COALESCE(paid_at, now()), updated_at = now()
      WHERE id = v_order.id;

      RAISE NOTICE 'Backfilled and confirmed order for reference: %', ref;
    ELSE
      RAISE NOTICE 'No order found for reference: %', ref;
    END IF;
  END LOOP;
END $$;