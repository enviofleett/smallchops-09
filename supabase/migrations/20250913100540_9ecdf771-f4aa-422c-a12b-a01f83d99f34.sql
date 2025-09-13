-- CRITICAL SECURITY FIX: Secure all payment-related tables
-- These tables contain sensitive financial data that could enable fraud

-- ===== PAYMENT INTEGRATIONS TABLE =====
-- Drop existing policies and create strict admin-only access
DROP POLICY IF EXISTS "Admins can manage payment integrations" ON public.payment_integrations;
DROP POLICY IF EXISTS "payment_integrations_admin_only" ON public.payment_integrations; 
DROP POLICY IF EXISTS "payment_integrations_service_role_only" ON public.payment_integrations;

CREATE POLICY "payment_integrations_secure" 
ON public.payment_integrations 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- ===== SAVED PAYMENT METHODS TABLE =====
-- CRITICAL: This had public access - major security vulnerability!
DROP POLICY IF EXISTS "Users manage own payment methods" ON public.saved_payment_methods;

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

-- Allow admins to manage all payment methods for support
CREATE POLICY "saved_payment_methods_admin" 
ON public.saved_payment_methods 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- ===== PAYMENT INTENTS TABLE =====
-- Clean up duplicate policies
DROP POLICY IF EXISTS "Admins can manage payment intents" ON public.payment_intents;
DROP POLICY IF EXISTS "Customers can view their payment intents" ON public.payment_intents;
DROP POLICY IF EXISTS "Service roles can manage payment intents" ON public.payment_intents;

CREATE POLICY "payment_intents_secure" 
ON public.payment_intents 
FOR SELECT 
TO authenticated
USING (
  -- Users can see their own payment intents through orders
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
-- Clean up the many duplicate policies
DROP POLICY IF EXISTS "Admins can manage payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Customers can view own payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Customers can view their payment transactions (by related order" ON public.payment_transactions;
DROP POLICY IF EXISTS "Only service roles can create payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Service role can manage payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Service roles can manage all payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Service roles can manage payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Service roles can manage payments" ON public.payment_transactions;
DROP POLICY IF EXISTS "Service roles can manage transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Users can create payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "customers can view their own payment transactions" ON public.payment_transactions;

-- Create clean, secure policies
CREATE POLICY "payment_transactions_customer_view" 
ON public.payment_transactions 
FOR SELECT 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    -- Match by customer email
    (customer_email IS NOT NULL AND lower(customer_email) = current_user_email())
    OR
    -- Match by related order
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

-- ===== ADDITIONAL PAYMENT TABLES SECURITY =====
-- Secure other sensitive payment tables

-- Payment Refunds - only admins and related customers
DROP POLICY IF EXISTS "payment_refunds_policy" ON public.payment_refunds;
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

-- Payment Audit Log - admin only
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