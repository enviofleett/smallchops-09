
-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Allow customers to view their order items via customer_id mapping (and keep email path)
-- This unblocks embedded order_items when querying orders by customer_id
CREATE POLICY "Customers can view order_items by customer_id or email"
  ON public.order_items
  FOR SELECT
  USING (
    order_id IN (
      SELECT o.id
      FROM public.orders AS o
      WHERE
        -- Match by customer_id through the authenticated user's customer_account
        o.customer_id IN (
          SELECT ca.id
          FROM public.customer_accounts AS ca
          WHERE ca.user_id = auth.uid()
        )
        OR
        -- Fallback match by customer_email
        o.customer_email IN (
          SELECT u.email
          FROM auth.users AS u
          WHERE u.id = auth.uid()
        )
    )
  );
