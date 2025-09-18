-- CRITICAL SECURITY FIX: Enable RLS and add policies for exposed tables

-- 1. Fix business_sensitive_data table
ALTER TABLE public.business_sensitive_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only_business_sensitive_data" ON public.business_sensitive_data
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

-- 2. Fix business_settings table  
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only_business_settings" ON public.business_settings
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "public_read_business_settings" ON public.business_settings
  FOR SELECT USING (true);

-- 3. Fix communication_settings table
ALTER TABLE public.communication_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only_communication_settings" ON public.communication_settings
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

-- 4. Fix environment_config table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'environment_config') THEN
    ALTER TABLE public.environment_config ENABLE ROW LEVEL SECURITY;
    
    EXECUTE 'CREATE POLICY "admin_only_environment_config" ON public.environment_config
      FOR ALL USING (is_admin())
      WITH CHECK (is_admin())';
  END IF;
END $$;

-- 5. Fix payment_transactions table
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_payment_transactions_access" ON public.payment_transactions
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "customer_own_payment_transactions" ON public.payment_transactions
  FOR SELECT USING (customer_id = auth.uid());

-- 6. Fix payment_intents table  
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_payment_intents_access" ON public.payment_intents
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "customer_own_payment_intents" ON public.payment_intents
  FOR SELECT USING (customer_id = auth.uid());

-- 7. Enhance orders table security (already has RLS but strengthen policies)
DROP POLICY IF EXISTS "admin_orders_full_access" ON public.orders;
DROP POLICY IF EXISTS "customer_orders_access" ON public.orders;

CREATE POLICY "admin_orders_full_access" ON public.orders
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "customer_view_own_orders" ON public.orders
  FOR SELECT USING (customer_id = auth.uid());

-- 8. Log security hardening
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'security_hardening_applied',
  'Security Audit',
  'Critical RLS policies applied to protect sensitive data',
  jsonb_build_object(
    'tables_secured', ARRAY['business_sensitive_data', 'business_settings', 'communication_settings', 'payment_transactions', 'payment_intents', 'orders'],
    'security_level', 'PRODUCTION_READY',
    'applied_at', now()
  )
);