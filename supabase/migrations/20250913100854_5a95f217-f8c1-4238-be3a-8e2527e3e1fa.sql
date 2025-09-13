-- CRITICAL SECURITY FIX: Secure all payment-related tables (SAFE VERSION)
-- These tables contain sensitive financial data that could enable fraud

-- First, let's safely drop ALL existing policies on critical payment tables

-- ===== PAYMENT INTEGRATIONS TABLE =====
DO $$ 
DECLARE 
    pol_name text;
BEGIN
    FOR pol_name IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'payment_integrations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.payment_integrations', pol_name);
    END LOOP;
END $$;

CREATE POLICY "payment_integrations_secure" 
ON public.payment_integrations 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- ===== SAVED PAYMENT METHODS TABLE =====
DO $$ 
DECLARE 
    pol_name text;
BEGIN
    FOR pol_name IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'saved_payment_methods'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.saved_payment_methods', pol_name);
    END LOOP;
END $$;

CREATE POLICY "saved_payment_methods_secure" 
ON public.saved_payment_methods 
FOR ALL 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
);

CREATE POLICY "saved_payment_methods_admin" 
ON public.saved_payment_methods 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- ===== PAYMENT INTENTS TABLE =====
DO $$ 
DECLARE 
    pol_name text;
BEGIN
    FOR pol_name IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'payment_intents'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.payment_intents', pol_name);
    END LOOP;
END $$;

CREATE POLICY "payment_intents_secure" 
ON public.payment_intents 
FOR SELECT 
TO authenticated
USING (
  order_id IN (
    SELECT o.id FROM orders o 
    WHERE (
      (o.customer_id IN (
        SELECT ca.id FROM customer_accounts ca 
        WHERE ca.user_id = auth.uid()
      )) 
      OR 
      (o.customer_email IS NOT NULL AND lower(o.customer_email) = current_user_email())
    )
  )
);

CREATE POLICY "payment_intents_admin" 
ON public.payment_intents 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "payment_intents_service" 
ON public.payment_intents 
FOR ALL 
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ===== PAYMENT TRANSACTIONS TABLE =====
DO $$ 
DECLARE 
    pol_name text;
BEGIN
    FOR pol_name IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'payment_transactions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.payment_transactions', pol_name);
    END LOOP;
END $$;

CREATE POLICY "payment_transactions_customer_view" 
ON public.payment_transactions 
FOR SELECT 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    (customer_email IS NOT NULL AND lower(customer_email) = current_user_email())
    OR
    (order_id IS NOT NULL AND order_id IN (
      SELECT o.id FROM orders o 
      WHERE (
        (o.customer_id IN (
          SELECT ca.id FROM customer_accounts ca 
          WHERE ca.user_id = auth.uid()
        )) 
        OR 
        (o.customer_email IS NOT NULL AND lower(o.customer_email) = current_user_email())
      )
    ))
  )
);

CREATE POLICY "payment_transactions_admin" 
ON public.payment_transactions 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "payment_transactions_service" 
ON public.payment_transactions 
FOR ALL 
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ===== PAYMENT REFUNDS TABLE =====
DO $$ 
DECLARE 
    pol_name text;
BEGIN
    FOR pol_name IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'payment_refunds'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.payment_refunds', pol_name);
    END LOOP;
END $$;

CREATE POLICY "payment_refunds_secure" 
ON public.payment_refunds 
FOR SELECT 
TO authenticated
USING (
  is_admin() 
  OR 
  (transaction_id IN (
    SELECT pt.id FROM payment_transactions pt 
    WHERE lower(pt.customer_email) = current_user_email()
  ))
);

CREATE POLICY "payment_refunds_admin" 
ON public.payment_refunds 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- ===== PAYMENT AUDIT LOG TABLE =====
DO $$ 
DECLARE 
    pol_name text;
BEGIN
    FOR pol_name IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'payment_audit_log'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.payment_audit_log', pol_name);
    END LOOP;
END $$;

CREATE POLICY "payment_audit_log_admin_only" 
ON public.payment_audit_log 
FOR SELECT 
TO authenticated
USING (is_admin());

-- Log this critical security fix
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  user_id,
  new_values
) VALUES (
  'critical_payment_security_fix_applied',
  'Security',
  'CRITICAL: Fixed payment system security vulnerabilities - removed public access and implemented strict RLS',
  auth.uid(),
  jsonb_build_object(
    'vulnerability_type', 'payment_system_data_exposure',
    'severity', 'critical',
    'tables_secured', ARRAY[
      'payment_integrations',
      'saved_payment_methods', 
      'payment_intents',
      'payment_transactions',
      'payment_refunds',
      'payment_audit_log'
    ],
    'critical_fix', 'saved_payment_methods table had public access vulnerability',
    'fix_applied_at', NOW()
  )
);