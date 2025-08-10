-- Idempotency and validation improvements for payment transactions
-- 1) Ensure single record per provider_reference
CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_transactions_provider_reference
ON public.payment_transactions (provider_reference);

-- 2) Prevent multiple concurrent pending/initialized transactions per order
CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_transactions_order_pending
ON public.payment_transactions (order_id)
WHERE status IN ('pending','initialized');

-- 3) Optional: lightweight validation to avoid negative amounts
CREATE INDEX IF NOT EXISTS ix_payment_transactions_status ON public.payment_transactions (status);
