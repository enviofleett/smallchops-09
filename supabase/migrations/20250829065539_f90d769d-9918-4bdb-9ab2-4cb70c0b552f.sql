-- Enable Row Level Security on all archive tables
ALTER TABLE public.customer_satisfaction_ratings_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_assignments_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_changes_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_processing_status_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions_archive ENABLE ROW LEVEL SECURITY;

-- Create admin-only access policies for all archive tables
CREATE POLICY "Admins can access customer satisfaction ratings archive"
  ON public.customer_satisfaction_ratings_archive
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can access order assignments archive"
  ON public.order_assignments_archive
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can access order items archive"
  ON public.order_items_archive
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can access order status changes archive"
  ON public.order_status_changes_archive
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can access orders archive"
  ON public.orders_archive
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can access payment processing status archive"
  ON public.payment_processing_status_archive
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can access payment transactions archive"
  ON public.payment_transactions_archive
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Add service role access for archival operations
CREATE POLICY "Service roles can manage customer satisfaction ratings archive"
  ON public.customer_satisfaction_ratings_archive
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service roles can manage order assignments archive"
  ON public.order_assignments_archive
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service roles can manage order items archive"
  ON public.order_items_archive
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service roles can manage order status changes archive"
  ON public.order_status_changes_archive
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service roles can manage orders archive"
  ON public.orders_archive
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service roles can manage payment processing status archive"
  ON public.payment_processing_status_archive
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service roles can manage payment transactions archive"
  ON public.payment_transactions_archive
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');