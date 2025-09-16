-- CRITICAL SECURITY FIXES FOR PRODUCTION READINESS

-- 1. Secure payment_transactions table with proper RLS
DROP POLICY IF EXISTS "Users can view their own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Service roles can manage payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_production_access" ON payment_transactions;

CREATE POLICY "payment_transactions_secure_access" 
ON payment_transactions 
FOR SELECT 
USING (
  -- Only authenticated users can access their own transactions
  (auth.uid() IS NOT NULL AND (
    customer_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid() OR customer_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  )) OR
  -- Admins can access all transactions
  is_admin() OR
  -- Service role for backend operations
  auth.role() = 'service_role'
);

CREATE POLICY "payment_transactions_secure_insert" 
ON payment_transactions 
FOR INSERT 
WITH CHECK (
  -- Only service role can create payment transactions
  auth.role() = 'service_role' OR
  -- Admins can create transactions
  is_admin()
);

CREATE POLICY "payment_transactions_secure_update" 
ON payment_transactions 
FOR UPDATE 
USING (
  -- Only service role can update payment transactions
  auth.role() = 'service_role' OR
  -- Admins can update transactions
  is_admin()
);

-- 2. Secure payment_intents table if exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_intents') THEN
    DROP POLICY IF EXISTS "payment_intents_user_access" ON payment_intents;
    
    CREATE POLICY "payment_intents_secure_access" 
    ON payment_intents 
    FOR ALL 
    USING (
      -- Only authenticated users can access their own intents
      auth.uid() IS NOT NULL AND (
        customer_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
        is_admin() OR
        auth.role() = 'service_role'
      )
    );
  END IF;
END $$;

-- 3. Add security audit logging trigger for payment transactions
CREATE OR REPLACE FUNCTION audit_payment_transaction_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log all payment transaction modifications
  INSERT INTO audit_logs (
    action, 
    category, 
    message, 
    user_id, 
    entity_id, 
    old_values, 
    new_values
  ) VALUES (
    TG_OP || '_payment_transaction',
    'Payment Security',
    'Payment transaction ' || TG_OP || ' operation',
    auth.uid(),
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for payment transactions audit
DROP TRIGGER IF EXISTS payment_transactions_audit_trigger ON payment_transactions;
CREATE TRIGGER payment_transactions_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION audit_payment_transaction_changes();

-- 4. Secure orders table for payment-related operations
DROP POLICY IF EXISTS "orders_production_payment_access" ON orders;
CREATE POLICY "orders_production_payment_access" 
ON orders 
FOR SELECT 
USING (
  -- Authenticated users can only access their own orders
  (auth.uid() IS NOT NULL AND (
    user_id = auth.uid() OR 
    customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )) OR
  -- Guest users can access by email match (for checkout)
  (auth.uid() IS NULL AND customer_email IS NOT NULL) OR
  -- Admins and service role have full access
  is_admin() OR 
  auth.role() = 'service_role'
);

-- 5. Add rate limiting table for payment operations
CREATE TABLE IF NOT EXISTS payment_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- user_id, email, or IP
  operation TEXT NOT NULL, -- 'payment_init', 'payment_verify', etc.
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(identifier, operation, date_trunc('hour', window_start))
);

-- RLS for rate limits table
ALTER TABLE payment_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_rate_limits_service_access" 
ON payment_rate_limits 
FOR ALL 
USING (auth.role() = 'service_role' OR is_admin());

-- 6. Create payment security monitoring function
CREATE OR REPLACE FUNCTION log_payment_security_event(
  p_event_type TEXT,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_severity TEXT DEFAULT 'info'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    category, 
    message,
    user_id,
    new_values
  ) VALUES (
    p_event_type,
    'Payment Security Monitor',
    'Payment security event: ' || p_event_type,
    auth.uid(),
    jsonb_build_object(
      'severity', p_severity,
      'details', p_details,
      'timestamp', NOW(),
      'user_id', auth.uid(),
      'session_info', jsonb_build_object(
        'ip', current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
        'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Secure environment_config table
ALTER TABLE environment_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "environment_config_admin_access" ON environment_config;
CREATE POLICY "environment_config_admin_access" 
ON environment_config 
FOR ALL 
USING (is_admin() OR auth.role() = 'service_role');

-- 8. Secure payment_integrations table  
ALTER TABLE payment_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_integrations_admin_access" ON payment_integrations;
CREATE POLICY "payment_integrations_admin_access" 
ON payment_integrations 
FOR ALL 
USING (is_admin() OR auth.role() = 'service_role');

-- 9. Add production safety check function
CREATE OR REPLACE FUNCTION check_production_payment_safety()
RETURNS JSONB AS $$
DECLARE
  safety_issues TEXT[] := '{}';
  issue_count INTEGER := 0;
BEGIN
  -- Check if test keys are being used in production
  IF EXISTS (
    SELECT 1 FROM payment_integrations 
    WHERE provider = 'paystack' 
    AND (test_public_key LIKE 'pk_test_%' AND NOT test_mode)
  ) THEN
    safety_issues := array_append(safety_issues, 'Test keys detected in live mode');
    issue_count := issue_count + 1;
  END IF;
  
  -- Check if RLS is enabled on critical tables
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename 
    WHERE t.tablename = 'payment_transactions' 
    AND c.relrowsecurity = true
  ) THEN
    safety_issues := array_append(safety_issues, 'RLS not enabled on payment_transactions');
    issue_count := issue_count + 1;
  END IF;
  
  RETURN jsonb_build_object(
    'is_safe', issue_count = 0,
    'issues', safety_issues,
    'issue_count', issue_count,
    'last_check', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;