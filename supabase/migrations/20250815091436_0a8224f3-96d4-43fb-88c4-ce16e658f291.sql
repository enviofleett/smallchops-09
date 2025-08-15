-- UNIFIED PAYMENT VERIFICATION SYSTEM - Compatible with existing constraints
-- Phase 1: Database Schema & Functions

-- Enable needed extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create app schema and enums
CREATE SCHEMA IF NOT EXISTS app;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_state') THEN
    CREATE TYPE app.payment_state AS ENUM ('pending','paid','failed','abandoned','refunded','partial');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider') THEN
    CREATE TYPE app.payment_provider AS ENUM ('paystack');
  END IF;
END$$;

-- Central sequence & reference generator (compatible with existing constraint format)
CREATE SEQUENCE IF NOT EXISTS app.ref_seq INCREMENT BY 1 MINVALUE 1;

CREATE OR REPLACE FUNCTION app.generate_reference(kind text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  seq bigint := nextval('app.ref_seq');
  ts_epoch bigint := extract(epoch from now())::bigint;
  rand_suffix text := substr(encode(gen_random_bytes(8), 'hex'),1,16);
BEGIN
  IF kind IS NULL OR kind NOT IN ('txn','ord') THEN
    RAISE EXCEPTION 'unsupported reference kind: %', kind USING errcode = '22023';
  END IF;
  -- Format: txn_<epoch>_<hex> to match existing regex ^(txn_|pay_)[0-9]+_[a-zA-Z0-9\-]+$
  RETURN format('%s_%s_%s', kind, ts_epoch::text, rand_suffix);
END$$;

-- Payment intents table (source of truth for reference allocation)
CREATE TABLE IF NOT EXISTS app.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider app.payment_provider NOT NULL DEFAULT 'paystack',
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  reference text UNIQUE,
  external_reference text,
  status app.payment_state NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to set reference automatically
CREATE OR REPLACE FUNCTION app.payment_intents_set_ref()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := app.generate_reference('txn');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_payment_intents_set_ref ON app.payment_intents;
CREATE TRIGGER trg_payment_intents_set_ref
BEFORE INSERT ON app.payment_intents
FOR EACH ROW EXECUTE FUNCTION app.payment_intents_set_ref();

-- Payment transactions table (immutable ledger)
CREATE TABLE IF NOT EXISTS app.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL REFERENCES app.payment_intents(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider app.payment_provider NOT NULL DEFAULT 'paystack',
  reference text NOT NULL,
  provider_ref text,
  status app.payment_state NOT NULL,
  raw jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reference)
);

CREATE INDEX IF NOT EXISTS idx_paytx_order ON app.payment_transactions(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paytx_reference ON app.payment_transactions(reference);

-- Orders with payment view (reliable latest status)
CREATE OR REPLACE VIEW app.orders_with_payment AS
SELECT
  o.*,
  pt.status as latest_payment_status,
  pt.reference as latest_payment_reference,
  pt.created_at as latest_payment_at
FROM public.orders o
LEFT JOIN LATERAL (
  SELECT t.*
  FROM app.payment_transactions t
  WHERE t.order_id = o.id
  ORDER BY t.created_at DESC
  LIMIT 1
) pt ON true;

-- RLS policies with corrected syntax
ALTER TABLE app.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Service role can write (block all other operations)
CREATE POLICY "service_write_intents" ON app.payment_intents
FOR ALL 
TO service_role
USING (true) 
WITH CHECK (true);

CREATE POLICY "service_write_tx" ON app.payment_transactions
FOR ALL 
TO service_role
USING (true) 
WITH CHECK (true);

-- Read-only for authenticated users
CREATE POLICY "read_intents" ON app.payment_intents
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "read_tx" ON app.payment_transactions
FOR SELECT 
TO authenticated
USING (true);

-- Main verification function (unified for delivery and pickup)
CREATE OR REPLACE FUNCTION app.verify_and_update_payment_status(
  p_order_id uuid,
  p_reference text,
  p_provider_ref text,
  p_provider app.payment_provider,
  p_new_state app.payment_state,
  p_amount numeric,
  p_currency text,
  p_raw jsonb
)
RETURNS TABLE (
  order_id uuid,
  order_payment_status text,
  normalized_reference text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order public.orders%rowtype;
  v_intent app.payment_intents%rowtype;
  v_ref text := p_reference;
  v_status app.payment_state := p_new_state;
  v_payment_status text;
BEGIN
  IF p_provider IS DISTINCT FROM 'paystack' THEN
    RAISE EXCEPTION 'Unsupported provider %', p_provider USING errcode='22023';
  END IF;

  -- Normalize legacy references (pay_*) by allocating a txn_*
  IF v_ref IS NULL OR v_ref LIKE 'pay_%' THEN
    v_ref := app.generate_reference('txn');
  END IF;

  -- Lock order row
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id USING errcode='NOORD';
  END IF;

  -- Ensure/attach an intent
  SELECT * INTO v_intent
  FROM app.payment_intents
  WHERE order_id = p_order_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO app.payment_intents(order_id, provider, amount, currency, external_reference, status)
    VALUES (p_order_id, p_provider, COALESCE(p_amount,0), COALESCE(p_currency,'NGN'), p_provider_ref, 'pending')
    RETURNING * INTO v_intent;
  END IF;

  -- Insert transaction idempotently
  BEGIN
    INSERT INTO app.payment_transactions(intent_id, order_id, provider, reference, provider_ref, status, raw)
    VALUES (v_intent.id, p_order_id, p_provider, v_ref, p_provider_ref, v_status, COALESCE(p_raw,'{}'::jsonb));
  EXCEPTION WHEN unique_violation THEN
    -- Already recorded; do nothing (idempotent)
  END;

  -- Map app.payment_state to existing payment_status enum values
  v_payment_status := CASE 
    WHEN v_status = 'paid' THEN 'paid'
    WHEN v_status = 'failed' THEN 'failed'
    WHEN v_status = 'abandoned' THEN 'pending'
    WHEN v_status = 'refunded' THEN 'refunded'
    WHEN v_status = 'partial' THEN 'pending'
    ELSE 'pending'
  END;

  -- Advance order.payment_status only forward (only if currently pending)
  IF v_order.payment_status = 'pending' OR v_order.payment_status IS NULL THEN
    IF v_status IN ('paid','failed','abandoned','refunded') THEN
      UPDATE public.orders
      SET payment_status = v_payment_status::payment_status,
          payment_reference = v_ref,
          updated_at = now()
      WHERE id = p_order_id;
    END IF;
  END IF;

  -- Return snapshot
  RETURN QUERY
  SELECT v_order.id,
         (SELECT payment_status::text FROM public.orders WHERE id = v_order.id),
         v_ref;
END$$;

-- Function to create payment intents
CREATE OR REPLACE FUNCTION app.create_payment_intent(
  p_order_id uuid,
  p_amount numeric,
  p_currency text DEFAULT 'NGN',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(intent_id uuid, reference text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_intent app.payment_intents%rowtype;
BEGIN
  INSERT INTO app.payment_intents(order_id, amount, currency, metadata)
  VALUES (p_order_id, p_amount, COALESCE(p_currency,'NGN'), COALESCE(p_metadata,'{}'::jsonb))
  RETURNING * INTO v_intent;

  RETURN QUERY SELECT v_intent.id, v_intent.reference;
END$$;

-- Phase 2: Migration & Data Cleanup (minimal - just for orders that need it)
-- Note: We'll skip migrating existing pay_* references to avoid constraint issues
-- The verification function handles both formats

-- Trigger for automatic order confirmation when paid
CREATE OR REPLACE FUNCTION app.on_order_paid()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
    UPDATE public.orders 
    SET status = 'confirmed', updated_at = now() 
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_on_order_paid ON public.orders;
CREATE TRIGGER trg_on_order_paid
AFTER UPDATE OF payment_status ON public.orders
FOR EACH ROW
WHEN (NEW.payment_status = 'paid')
EXECUTE FUNCTION app.on_order_paid();