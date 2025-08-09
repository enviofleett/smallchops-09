
-- 1) Helper: safe current user email from JWT (no auth.users reads)
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT lower((auth.jwt() ->> 'email'));
$$;

-- 2) Ensure RLS enabled
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 3) Remove policies that reference auth.users (cause 403)
DROP POLICY IF EXISTS "Customers can view order_items by customer_id or email" ON public.order_items;
DROP POLICY IF EXISTS "Customers can view their own order items" ON public.order_items;

-- 4) Single clean SELECT policy (customer_id OR JWT email path; no auth.users reference)
CREATE POLICY "Customers can view their order items (by customer_id or jwt email)"
ON public.order_items
FOR SELECT
USING (
  order_id IN (
    SELECT o.id
    FROM public.orders AS o
    WHERE
      -- Authenticated customer via customer_accounts link
      (o.customer_id IS NOT NULL AND o.customer_id IN (
        SELECT ca.id
        FROM public.customer_accounts AS ca
        WHERE ca.user_id = auth.uid()
      ))
      OR
      -- Guest/legacy orders matched by JWT email (safe)
      (
        o.customer_email IS NOT NULL
        AND lower(o.customer_email) = public.current_user_email()
      )
  )
);
