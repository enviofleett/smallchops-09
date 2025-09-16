-- CRITICAL SECURITY FIXES FOR PRODUCTION READINESS (SAFE VERSION)

-- 1. Secure payment_transactions table with proper RLS
DROP POLICY IF EXISTS "Users can view their own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Service roles can manage payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_production_access" ON payment_transactions;

CREATE POLICY "payment_transactions_secure_access" 
ON payment_transactions 
FOR SELECT 
USING (
  -- Service role for backend operations
  auth.role() = 'service_role' OR
  -- Admins can access all transactions
  is_admin() OR
  -- Only authenticated users can access their own transactions
  (auth.uid() IS NOT NULL AND (
    customer_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid() OR customer_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  ))
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

-- 2. Add security audit logging trigger for payment transactions
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

-- 3. Create payment security monitoring function
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
      'user_id', auth.uid()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Add production safety check function
CREATE OR REPLACE FUNCTION check_production_payment_safety()
RETURNS JSONB AS $$
DECLARE
  safety_issues TEXT[] := '{}';
  issue_count INTEGER := 0;
BEGIN
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
  
  -- Check if orders table has proper RLS
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename 
    WHERE t.tablename = 'orders' 
    AND c.relrowsecurity = true
  ) THEN
    safety_issues := array_append(safety_issues, 'RLS not enabled on orders');
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