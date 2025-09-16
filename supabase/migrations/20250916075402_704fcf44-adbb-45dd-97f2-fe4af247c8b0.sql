-- Fix remaining function search path issues and create production monitoring
DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Fix all remaining functions that need search_path
  FOR func_record IN 
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.prosecdef = true -- SECURITY DEFINER functions
    AND NOT EXISTS (
      SELECT 1 FROM pg_proc_config pc 
      WHERE pc.oid = p.oid 
      AND pc.setting[1] LIKE 'search_path%'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', 
                     func_record.nspname, 
                     func_record.proname, 
                     func_record.args);
    EXCEPTION WHEN OTHERS THEN
      -- Continue if function doesn't exist or can't be modified
      NULL;
    END;
  END LOOP;
END $$;

-- Create production readiness monitoring function
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