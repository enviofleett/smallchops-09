-- Production-ready Paystack integration hardening (Fixed version)
-- This migration adds idempotency, race condition protection, and data integrity

-- 1. Add idempotency and processing control columns to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
ADD COLUMN IF NOT EXISTS processing_lock BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS amount_kobo INTEGER;

-- 2. Add idempotency and processing control columns to payment_transactions
ALTER TABLE public.payment_transactions 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
ADD COLUMN IF NOT EXISTS processing_lock BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS amount_kobo INTEGER,
ADD COLUMN IF NOT EXISTS webhook_event_id TEXT,
ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMP WITH TIME ZONE;

-- 3. Create unique partial indexes for idempotency and performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference_unique 
ON public.orders (payment_reference) 
WHERE payment_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key_unique 
ON public.orders (idempotency_key) 
WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_idempotency_key_unique 
ON public.payment_transactions (idempotency_key) 
WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_provider_reference_unique 
ON public.payment_transactions (provider_reference) 
WHERE provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_webhook_event_id_unique 
ON public.payment_transactions (webhook_event_id) 
WHERE webhook_event_id IS NOT NULL;

-- 4. Add performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orders_status_payment_reference 
ON public.orders (status, payment_reference) 
WHERE payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_status_created_at 
ON public.payment_transactions (status, created_at);

-- 5. Update amount_kobo columns based on existing amounts (NGN to kobo conversion)
UPDATE public.orders 
SET amount_kobo = ROUND(total_amount * 100)::INTEGER 
WHERE amount_kobo IS NULL AND total_amount IS NOT NULL;

UPDATE public.payment_transactions 
SET amount_kobo = ROUND(amount * 100)::INTEGER 
WHERE amount_kobo IS NULL AND amount IS NOT NULL;

-- 6. Create function for atomic payment processing
CREATE OR REPLACE FUNCTION public.process_payment_atomically(
  p_payment_reference TEXT,
  p_idempotency_key TEXT,
  p_amount_kobo INTEGER,
  p_status TEXT DEFAULT 'confirmed',
  p_webhook_event_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  order_id UUID,
  order_number TEXT,
  previous_status TEXT,
  new_status TEXT,
  amount_verified BOOLEAN
) 
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
  
  IF FOUND AND v_order_record.status = p_status THEN
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
  
  -- Update order atomically
  UPDATE orders 
  SET 
    status = p_status::order_status,
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

-- 7. Create function for safe idempotency key generation
CREATE OR REPLACE FUNCTION public.generate_payment_idempotency_key(
  p_prefix TEXT DEFAULT 'pay'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN p_prefix || '_' || extract(epoch from now())::bigint::text || '_' || 
         replace(gen_random_uuid()::text, '-', '');
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback if gen_random_uuid fails
    RETURN p_prefix || '_' || extract(epoch from now())::bigint::text || '_' || 
           floor(random() * 1000000000)::text;
END;
$function$;