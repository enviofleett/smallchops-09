-- Create production readiness monitoring function (simplified)
CREATE OR REPLACE FUNCTION check_production_readiness()
RETURNS JSONB AS $$
DECLARE
  readiness_issues TEXT[] := '{}';
  issue_count INTEGER := 0;
  result JSONB;
BEGIN
  -- Check payment system safety
  SELECT check_production_payment_safety() INTO result;
  IF (result->>'is_safe')::boolean = false THEN
    readiness_issues := array_cat(readiness_issues, 
      ARRAY(SELECT jsonb_array_elements_text(result->'issues')));
    issue_count := issue_count + (result->>'issue_count')::integer;
  END IF;
  
  -- Check if business settings exist
  IF NOT EXISTS (SELECT 1 FROM business_settings LIMIT 1) THEN
    readiness_issues := array_append(readiness_issues, 'Business settings not configured');
    issue_count := issue_count + 1;
  END IF;
  
  -- Check if communication settings exist
  IF NOT EXISTS (SELECT 1 FROM communication_settings LIMIT 1) THEN
    readiness_issues := array_append(readiness_issues, 'Email communication not configured');
    issue_count := issue_count + 1;
  END IF;
  
  -- Check if payment integrations exist
  IF NOT EXISTS (SELECT 1 FROM payment_integrations WHERE provider = 'paystack' LIMIT 1) THEN
    readiness_issues := array_append(readiness_issues, 'Paystack integration not configured');
    issue_count := issue_count + 1;
  END IF;
  
  -- Check if environment config exists
  IF NOT EXISTS (SELECT 1 FROM environment_config LIMIT 1) THEN
    readiness_issues := array_append(readiness_issues, 'Environment configuration missing');
    issue_count := issue_count + 1;
  END IF;
  
  RETURN jsonb_build_object(
    'is_production_ready', issue_count = 0,
    'issues', readiness_issues,
    'issue_count', issue_count,
    'last_check', NOW(),
    'payment_safety', result,
    'status', CASE WHEN issue_count = 0 THEN 'ready' 
                   WHEN issue_count < 3 THEN 'needs_attention' 
                   ELSE 'not_ready' END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create comprehensive security check function
CREATE OR REPLACE FUNCTION run_security_audit() 
RETURNS JSONB AS $$
DECLARE
  security_issues TEXT[] := '{}';
  issue_count INTEGER := 0;
  critical_count INTEGER := 0;
BEGIN
  -- Check RLS on critical tables
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON c.relnamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND c.relname = 'payment_transactions' 
    AND c.relrowsecurity = true
  ) THEN
    security_issues := array_append(security_issues, 'CRITICAL: RLS not enabled on payment_transactions');
    issue_count := issue_count + 1;
    critical_count := critical_count + 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON c.relnamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND c.relname = 'orders' 
    AND c.relrowsecurity = true
  ) THEN
    security_issues := array_append(security_issues, 'CRITICAL: RLS not enabled on orders');
    issue_count := issue_count + 1;
    critical_count := critical_count + 1;
  END IF;

  -- Check if sensitive tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_accounts') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c 
      JOIN pg_namespace n ON c.relnamespace = n.oid 
      WHERE n.nspname = 'public' 
      AND c.relname = 'customer_accounts' 
      AND c.relrowsecurity = true
    ) THEN
      security_issues := array_append(security_issues, 'WARNING: RLS not enabled on customer_accounts');
      issue_count := issue_count + 1;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'is_secure', critical_count = 0,
    'issues', security_issues,
    'total_issues', issue_count,
    'critical_issues', critical_count,
    'last_audit', NOW(),
    'risk_level', CASE 
      WHEN critical_count > 0 THEN 'HIGH'
      WHEN issue_count > 2 THEN 'MEDIUM'
      ELSE 'LOW'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;