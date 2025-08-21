
-- 1) Create payment_transactions if it does not exist
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  reference TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'paystack',
  provider_reference TEXT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending',
  authorization_url TEXT NULL,
  access_code TEXT NULL,
  customer_email TEXT NULL,
  gateway_response JSONB NULL,
  raw_provider_payload JSONB NULL,
  verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Bring existing table up to spec (idempotent, only adds missing columns)
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'paystack' NOT NULL,
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN' NOT NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS authorization_url TEXT,
  ADD COLUMN IF NOT EXISTS access_code TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS gateway_response JSONB,
  ADD COLUMN IF NOT EXISTS raw_provider_payload JSONB,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3) Constraints and indexes
-- Unique reference (a single logical transaction per reference)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'payment_transactions_reference_key'
  ) THEN
    -- Use a unique index name that won't collide if PK/constraint already exists
    CREATE UNIQUE INDEX payment_transactions_reference_key
      ON public.payment_transactions (reference);
  END IF;
END$$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS payment_transactions_order_idx ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS payment_transactions_status_idx ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS payment_transactions_created_at_idx ON public.payment_transactions(created_at);

-- 4) Ensure updated_at stays fresh
DROP TRIGGER IF EXISTS trg_payment_transactions_updated_at ON public.payment_transactions;
CREATE TRIGGER trg_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payment_transaction_timestamp();

-- 5) Harden allowed statuses with a CHECK that is stable
ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_status_check;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_status_check
  CHECK (status IN ('initialized','pending','completed','failed','cancelled','refunded'));

-- 6) RLS: enable and add safe policies (service role full access; customers can view their own)
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Service role full access (Edge Functions)
DROP POLICY IF EXISTS "service role full access" ON public.payment_transactions;
CREATE POLICY "service role full access"
  ON public.payment_transactions
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated users to SELECT their own transactions via orders -> customer_accounts(user_id)
DROP POLICY IF EXISTS "customers can view their own payment transactions" ON public.payment_transactions;
CREATE POLICY "customers can view their own payment transactions"
  ON public.payment_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.customer_accounts ca ON ca.id = o.customer_id
      WHERE o.id = public.payment_transactions.order_id
        AND ca.user_id = auth.uid()
    )
  );

-- Explicitly prevent non-service-role writes (INSERT/UPDATE/DELETE) by not creating policies for them.
-- Only Edge Functions (service role) can write.
