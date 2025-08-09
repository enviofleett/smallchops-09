
-- 0) Enable pgcrypto for gen_random_bytes used by guest session IDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Helper is already present, but keep it idempotent
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT lower((auth.jwt() ->> 'email'));
$$;

-- 2) ORDERS: replace customer-facing SELECT policies with safe versions
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop legacy customer-facing policies and an overly-permissive one
DROP POLICY IF EXISTS "Customers can select their orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can view own orders by email" ON public.orders;
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated users full access to orders" ON public.orders;

-- Add one clean SELECT policy (no auth.users reference)
CREATE POLICY "Customers can view orders (by customer_id or jwt email)"
ON public.orders
FOR SELECT
USING (
  (
    customer_id IS NOT NULL AND customer_id IN (
      SELECT ca.id
      FROM public.customer_accounts AS ca
      WHERE ca.user_id = auth.uid()
    )
  )
  OR
  (
    customer_email IS NOT NULL AND lower(customer_email) = public.current_user_email()
  )
);

-- 3) PAYMENT TRANSACTIONS: replace customer-facing SELECT policies with safe versions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can select their payment tx" ON public.payment_transactions;
DROP POLICY IF EXISTS "Customers can view their own payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Customers can view their own transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Users can view their own payment transactions" ON public.payment_transactions;

CREATE POLICY "Customers can view their payment transactions (by related order or jwt email)"
ON public.payment_transactions
FOR SELECT
USING (
  (
    order_id IS NOT NULL AND order_id IN (
      SELECT o.id
      FROM public.orders o
      WHERE
        (o.customer_id IS NOT NULL AND o.customer_id IN (
          SELECT ca.id FROM public.customer_accounts ca WHERE ca.user_id = auth.uid()
        ))
        OR
        (o.customer_email IS NOT NULL AND lower(o.customer_email) = public.current_user_email())
    )
  )
  OR
  (
    customer_email IS NOT NULL AND lower(customer_email) = public.current_user_email()
  )
);

-- 4) ORDER MODIFICATIONS: fix customer-facing SELECT policy to avoid auth.users
ALTER TABLE public.order_modifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view their order modifications" ON public.order_modifications;

CREATE POLICY "Customers can view their order modifications (safe)"
ON public.order_modifications
FOR SELECT
USING (
  order_id IN (
    SELECT o.id
    FROM public.orders o
    WHERE
      (o.customer_id IS NOT NULL AND o.customer_id IN (
        SELECT ca.id FROM public.customer_accounts ca WHERE ca.user_id = auth.uid()
      ))
      OR
      (o.customer_email IS NOT NULL AND lower(o.customer_email) = public.current_user_email())
  )
);
