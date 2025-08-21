
-- Enable RLS (safe if already enabled)
ALTER TABLE public.order_delivery_schedule ENABLE ROW LEVEL SECURITY;

-- Clean up prior policies with same names if they exist
DROP POLICY IF EXISTS "ods_select_own" ON public.order_delivery_schedule;
DROP POLICY IF EXISTS "ods_insert_own" ON public.order_delivery_schedule;
DROP POLICY IF EXISTS "ods_update_own" ON public.order_delivery_schedule;

-- Allow authenticated customers to SELECT their own schedules
CREATE POLICY "ods_select_own"
  ON public.order_delivery_schedule
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.customer_accounts ca ON ca.id = o.customer_id
      WHERE o.id = order_delivery_schedule.order_id
        AND ca.user_id = auth.uid()
    )
  );

-- Allow authenticated customers to INSERT schedules for their own orders
CREATE POLICY "ods_insert_own"
  ON public.order_delivery_schedule
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.customer_accounts ca ON ca.id = o.customer_id
      WHERE o.id = order_delivery_schedule.order_id
        AND ca.user_id = auth.uid()
    )
  );

-- Allow authenticated customers to UPDATE schedules for their own orders
CREATE POLICY "ods_update_own"
  ON public.order_delivery_schedule
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.customer_accounts ca ON ca.id = o.customer_id
      WHERE o.id = order_delivery_schedule.order_id
        AND ca.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.customer_accounts ca ON ca.id = o.customer_id
      WHERE o.id = order_delivery_schedule.order_id
        AND ca.user_id = auth.uid()
    )
  );
