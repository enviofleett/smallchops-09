-- Fix migration error: remove NEW from RLS policy WITH CHECK
DROP POLICY IF EXISTS "Allow order updates" ON public.orders;
CREATE POLICY "Allow order updates"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    status::text IN (
      'pending','confirmed','preparing','ready','out_for_delivery','delivered','completed','cancelled','refunded'
    )
  );