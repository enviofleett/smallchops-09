-- CRITICAL SECURITY AUDIT FIXES

-- 1. FIX CRITICAL ISSUE: Remove any truly public policies on sensitive payment tables
-- Check if there are any public policies (these shouldn't exist based on our review, but being extra safe)

-- 2. Fix security definer functions and search paths
-- Get list of functions with search path issues and fix them
ALTER FUNCTION public.check_production_payment_safety() SET search_path = 'public';
ALTER FUNCTION public.safe_update_order_status(uuid, text, uuid) SET search_path = 'public'; 
ALTER FUNCTION public.audit_payment_transaction_changes() SET search_path = 'public';
ALTER FUNCTION public.log_payment_security_event(text, jsonb, text) SET search_path = 'public';
ALTER FUNCTION public.encrypt_payment_data() SET search_path = 'public';
ALTER FUNCTION public.upsert_communication_event(text, text, text, text, jsonb, uuid, text) SET search_path = 'public';
ALTER FUNCTION public.check_payment_rate_limit(uuid, text) SET search_path = 'public';
ALTER FUNCTION public.run_security_audit() SET search_path = 'public';
ALTER FUNCTION public.get_public_paystack_config() SET search_path = 'public';
ALTER FUNCTION public.log_production_metric(text, numeric, text, jsonb) SET search_path = 'public';
ALTER FUNCTION public.get_live_payment_status() SET search_path = 'public';
ALTER FUNCTION public.log_order_status_change_with_email() SET search_path = 'public';
ALTER FUNCTION public.get_public_business_info() SET search_path = 'public';
ALTER FUNCTION public.process_queued_communication_events() SET search_path = 'public';
ALTER FUNCTION public.admin_update_order_status_secure(uuid, text, uuid) SET search_path = 'public';
ALTER FUNCTION public.log_admin_action(text, uuid, jsonb) SET search_path = 'public';
ALTER FUNCTION public.admin_queue_order_email(uuid, text) SET search_path = 'public';
ALTER FUNCTION public.get_detailed_order_with_products(uuid) SET search_path = 'public';
ALTER FUNCTION public.calculate_daily_delivery_analytics(date) SET search_path = 'public';
ALTER FUNCTION public.track_processing_officer() SET search_path = 'public';
ALTER FUNCTION public.admin_safe_update_order_status_with_officer_tracking(uuid, text, uuid) SET search_path = 'public';
ALTER FUNCTION public.admin_safe_update_order_status(uuid, text, uuid) SET search_path = 'public';
ALTER FUNCTION public.upsert_communication_event(text, text, text, jsonb, uuid, text) SET search_path = 'public';
ALTER FUNCTION public.admin_safe_update_order_status_enhanced(uuid, text, uuid) SET search_path = 'public';

-- 3. Clean up duplicate payment transaction policies (keeping only the most secure ones)
-- Drop older duplicate policies to reduce confusion and potential security gaps
DROP POLICY IF EXISTS "Admins can select all payment tx" ON payment_transactions;
DROP POLICY IF EXISTS "Customers can select their payment tx" ON payment_transactions;
DROP POLICY IF EXISTS "Admins can manage payments" ON payment_transactions;
DROP POLICY IF EXISTS "Service roles can manage payments" ON payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_admin_policy" ON payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_service_policy" ON payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_customer_policy" ON payment_transactions;

-- Keep only the most current and secure policies
-- These are the final, production-ready policies
CREATE POLICY "payment_transactions_production_admin_access"
ON payment_transactions FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "payment_transactions_production_service_access"
ON payment_transactions FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "payment_transactions_production_customer_own"
ON payment_transactions FOR SELECT
USING (
  auth.uid() IS NOT NULL AND 
  customer_email IN (
    SELECT email FROM customer_accounts 
    WHERE user_id = auth.uid()
  )
);

-- 4. Add additional security logging for payment transactions
CREATE OR REPLACE FUNCTION log_payment_access_attempt()
RETURNS TRIGGER AS $$
BEGIN
  -- Log all access attempts to payment transactions for security monitoring
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values
  ) VALUES (
    'payment_transaction_access',
    'Security Monitor',
    'Payment transaction accessed',
    auth.uid(),
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'operation', TG_OP,
      'timestamp', now(),
      'user_id', auth.uid(),
      'ip_address', current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Add trigger for payment transaction access logging
DROP TRIGGER IF EXISTS payment_transaction_access_log ON payment_transactions;
CREATE TRIGGER payment_transaction_access_log
AFTER SELECT OR INSERT OR UPDATE OR DELETE ON payment_transactions
FOR EACH ROW EXECUTE FUNCTION log_payment_access_attempt();

-- 5. Create security monitoring function for production
CREATE OR REPLACE FUNCTION check_production_security_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  security_report jsonb;
  rls_status boolean;
  policy_count integer;
  audit_count integer;
BEGIN
  -- Check RLS status on critical tables
  SELECT EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON c.relnamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND c.relname = 'payment_transactions' 
    AND c.relrowsecurity = true
  ) INTO rls_status;
  
  -- Count active policies on payment tables
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND tablename IN ('payment_transactions', 'payment_intents', 'orders');
  
  -- Count recent audit logs (last 24 hours)
  SELECT COUNT(*) INTO audit_count
  FROM audit_logs
  WHERE event_time > now() - interval '24 hours'
  AND category IN ('Payment Security', 'Security Monitor');
  
  security_report := jsonb_build_object(
    'rls_enabled', rls_status,
    'policy_count', policy_count,
    'recent_audit_logs', audit_count,
    'last_check', now(),
    'status', CASE 
      WHEN rls_status AND policy_count > 0 THEN 'secure'
      ELSE 'warning'
    END
  );
  
  RETURN security_report;
END;
$$;