
-- Create order_payment_accounts table for virtual account details
-- Note: FK to orders is omitted as the orders table is managed externally
CREATE TABLE public.order_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'paystack',
  provider_reference TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

ALTER TABLE public.order_payment_accounts ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage payment accounts"
  ON public.order_payment_accounts FOR ALL
  TO authenticated
  USING (is_admin_user(auth.uid()));

-- Service role access for edge functions and webhooks
CREATE POLICY "Service role full access"
  ON public.order_payment_accounts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
