-- Idempotency indexes for payment transactions (safe to apply)
-- 1) Unique provider_reference across all transactions
CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_transactions_provider_reference
ON public.payment_transactions (provider_reference);

-- 2) Unique pair of (order_id, provider_reference)
CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_transactions_order_reference
ON public.payment_transactions (order_id, provider_reference);

-- 3) Helpful status index
CREATE INDEX IF NOT EXISTS ix_payment_transactions_status ON public.payment_transactions (status);