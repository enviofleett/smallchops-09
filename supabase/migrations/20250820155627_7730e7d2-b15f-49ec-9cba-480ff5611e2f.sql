
-- Ensure unique provider references to enforce idempotency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_transactions_provider_reference_key'
  ) THEN
    ALTER TABLE public.payment_transactions
    ADD CONSTRAINT payment_transactions_provider_reference_key
    UNIQUE (provider_reference);
  END IF;
END$$;

-- Helpful index for transaction lookups by order
CREATE INDEX IF NOT EXISTS idx_payment_tx_order_id
  ON public.payment_transactions(order_id);

-- Speed up order lookups by reference (init re-use and webhook reconciliation)
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference
  ON public.orders(payment_reference);
