
-- 1) Unique payment reference per order (nullable unique)
-- Ensures only one order can hold a specific payment reference
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference_unique 
ON public.orders (payment_reference) 
WHERE payment_reference IS NOT NULL;

-- 2) Unique provider reference in payment transactions
-- Enforces idempotency at the DB level for Paystack references
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_provider_ref_unique 
ON public.payment_transactions (provider_reference);

-- 3) Fast idempotency lookup for pending/initialized payments
-- Speeds up reuse checks and reduces duplicate initializations
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_status 
ON public.payment_transactions (order_id, status)
WHERE status IN ('pending', 'initialized');
