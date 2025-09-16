-- CRITICAL SECURITY AUDIT FIXES (Fixed Version)

-- 1. Fix security definer functions and search paths for all functions that need it
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

-- 2. Clean up duplicate payment transaction policies (keeping only the most secure ones)
-- Drop older duplicate policies to reduce confusion and potential security gaps
DROP POLICY IF EXISTS "Admins can select all payment tx" ON payment_transactions;
DROP POLICY IF EXISTS "Customers can select their payment tx" ON payment_transactions;
DROP POLICY IF EXISTS "Admins can manage payments" ON payment_transactions;
DROP POLICY IF EXISTS "Service roles can manage payments" ON payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_admin_policy" ON payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_service_policy" ON payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_customer_policy" ON payment_transactions;

-- 3. Add comprehensive audit logging for payment access (instead of problematic trigger)
CREATE OR REPLACE FUNCTION log_critical_payment_access(
  operation_type text,
  table_name text,
  record_id uuid,
  user_context jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log critical payment operations for security monitoring
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values
  ) VALUES (
    operation_type,
    'Critical Payment Security',
    'Critical payment operation: ' || operation_type || ' on ' || table_name,
    auth.uid(),
    record_id,
    jsonb_build_object(
      'table', table_name,
      'operation', operation_type,
      'timestamp', now(),
      'user_id', auth.uid(),
      'context', user_context
    )
  );
END;
$$;

-- 4. Create production security monitoring function
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
  payment_policies integer;
  order_policies integer;
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
  
  -- Count payment-specific policies
  SELECT COUNT(*) INTO payment_policies
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND tablename = 'payment_transactions';
  
  -- Count order-specific policies
  SELECT COUNT(*) INTO order_policies
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND tablename = 'orders';
  
  -- Count recent audit logs (last 24 hours)
  SELECT COUNT(*) INTO audit_count
  FROM audit_logs
  WHERE event_time > now() - interval '24 hours'
  AND category IN ('Payment Security', 'Security Monitor', 'Critical Payment Security');
  
  security_report := jsonb_build_object(
    'rls_enabled', rls_status,
    'total_policy_count', policy_count,
    'payment_policies', payment_policies,
    'order_policies', order_policies,
    'recent_audit_logs', audit_count,
    'last_check', now(),
    'status', CASE 
      WHEN rls_status AND policy_count >= 10 THEN 'secure'
      WHEN rls_status AND policy_count >= 5 THEN 'warning'
      ELSE 'critical'
    END,
    'recommendations', CASE 
      WHEN NOT rls_status THEN jsonb_build_array('Enable RLS on payment_transactions table')
      WHEN policy_count < 5 THEN jsonb_build_array('Add more restrictive policies for payment tables')
      ELSE jsonb_build_array('Security status is good')
    END
  );
  
  RETURN security_report;
END;
$$;

-- 5. Create function to verify production readiness
CREATE OR REPLACE FUNCTION check_production_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
  security_check jsonb;
  rls_enabled boolean;
  admin_count integer;
  paystack_configured boolean;
  communication_configured boolean;
  recent_orders integer;
BEGIN
  -- Get security status
  SELECT check_production_security_status() INTO security_check;
  
  -- Check if RLS is enabled on critical tables
  SELECT (security_check->>'rls_enabled')::boolean INTO rls_enabled;
  
  -- Count admin users
  SELECT COUNT(*) INTO admin_count
  FROM customer_accounts ca
  WHERE EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = ca.user_id 
    AND p.role = 'admin'
  );
  
  -- Check Paystack configuration
  SELECT EXISTS (
    SELECT 1 FROM paystack_secure_config 
    WHERE is_active = true 
    AND (live_secret_key IS NOT NULL OR test_secret_key IS NOT NULL)
  ) INTO paystack_configured;
  
  -- Check communication configuration
  SELECT EXISTS (
    SELECT 1 FROM communication_settings 
    WHERE sender_email IS NOT NULL
  ) INTO communication_configured;
  
  -- Count recent orders (last 7 days)
  SELECT COUNT(*) INTO recent_orders
  FROM orders
  WHERE created_at > now() - interval '7 days';
  
  result := jsonb_build_object(
    'ready_for_production', (
      rls_enabled AND 
      admin_count > 0 AND 
      paystack_configured AND 
      communication_configured
    ),
    'score', (
      CASE WHEN rls_enabled THEN 25 ELSE 0 END +
      CASE WHEN admin_count > 0 THEN 25 ELSE 0 END +
      CASE WHEN paystack_configured THEN 25 ELSE 0 END +
      CASE WHEN communication_configured THEN 25 ELSE 0 END
    ),
    'checks', jsonb_build_object(
      'security_rls_enabled', rls_enabled,
      'admin_users_configured', admin_count > 0,
      'paystack_configured', paystack_configured,
      'communication_configured', communication_configured,
      'has_recent_activity', recent_orders > 0
    ),
    'security_details', security_check,
    'issues', (
      CASE WHEN NOT rls_enabled THEN jsonb_build_array('RLS not enabled on critical tables') ELSE '[]'::jsonb END ||
      CASE WHEN admin_count = 0 THEN jsonb_build_array('No admin users configured') ELSE '[]'::jsonb END ||
      CASE WHEN NOT paystack_configured THEN jsonb_build_array('Paystack not configured') ELSE '[]'::jsonb END ||
      CASE WHEN NOT communication_configured THEN jsonb_build_array('Email communication not configured') ELSE '[]'::jsonb END
    ),
    'warnings', (
      CASE WHEN recent_orders = 0 THEN jsonb_build_array('No recent order activity') ELSE '[]'::jsonb END
    ),
    'last_checked', now()
  );
  
  RETURN result;
END;
$$;