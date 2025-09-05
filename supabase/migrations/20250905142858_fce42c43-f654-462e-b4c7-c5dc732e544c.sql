-- Fix database linter security issues

-- 1. Fix function search paths (SECURITY FIX)
CREATE OR REPLACE FUNCTION public.check_auth_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  recent_users_count integer;
  verified_users_count integer;
  recent_logins integer;
  failed_logins integer;
  score integer := 100;
  issues text[] := '{}';
  warnings text[] := '{}';
BEGIN
  -- Count recent user registrations (last 30 days)
  SELECT COUNT(*) INTO recent_users_count
  FROM customer_accounts
  WHERE created_at >= NOW() - INTERVAL '30 days';
  
  -- Count verified users
  SELECT COUNT(*) INTO verified_users_count
  FROM customer_accounts
  WHERE email_verified = true
    AND created_at >= NOW() - INTERVAL '30 days';
  
  -- Count authentication events (last 24 hours)
  SELECT COUNT(*) INTO recent_logins
  FROM customer_auth_audit
  WHERE created_at >= NOW() - INTERVAL '24 hours'
    AND success = true;
  
  SELECT COUNT(*) INTO failed_logins
  FROM customer_auth_audit
  WHERE created_at >= NOW() - INTERVAL '24 hours'
    AND success = false;
  
  -- Calculate score and identify issues
  IF recent_users_count = 0 THEN
    score := score - 30;
    issues := array_append(issues, 'No recent user registrations');
  END IF;
  
  IF verified_users_count < (recent_users_count * 0.8) THEN
    score := score - 20;
    warnings := array_append(warnings, 'Low email verification rate');
  END IF;
  
  IF failed_logins > (recent_logins * 0.1) THEN
    score := score - 15;
    warnings := array_append(warnings, 'High authentication failure rate');
  END IF;
  
  IF recent_logins = 0 AND recent_users_count > 0 THEN
    score := score - 25;
    issues := array_append(issues, 'No successful logins in 24 hours');
  END IF;
  
  result := jsonb_build_object(
    'healthy', score >= 80,
    'score', GREATEST(score, 0),
    'metrics', jsonb_build_object(
      'total_users', recent_users_count,
      'verified_users', verified_users_count,
      'verification_rate', CASE 
        WHEN recent_users_count > 0 THEN ROUND((verified_users_count::decimal / recent_users_count * 100), 1)
        ELSE 0 
      END,
      'successful_auth', recent_logins,
      'failed_auth', failed_logins,
      'failure_rate', CASE 
        WHEN (recent_logins + failed_logins) > 0 THEN ROUND((failed_logins::decimal / (recent_logins + failed_logins) * 100), 1)
        ELSE 0 
      END
    ),
    'issues', array_to_json(issues),
    'warnings', array_to_json(warnings),
    'status', CASE 
      WHEN score >= 90 THEN 'excellent'
      WHEN score >= 80 THEN 'good'
      WHEN score >= 60 THEN 'warning'
      ELSE 'critical'
    END,
    'last_checked', NOW()
  );
  
  RETURN result;
END;
$$;

-- 2. Create RLS status check function (SECURITY FIX)
CREATE OR REPLACE FUNCTION public.check_rls_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  rls_tables integer := 0;
  total_tables integer := 0;
  critical_tables text[] := ARRAY['customer_accounts', 'orders', 'payment_transactions', 'profiles'];
  missing_rls text[] := '{}';
  table_name text;
  has_rls boolean;
BEGIN
  -- Check RLS on critical tables
  FOREACH table_name IN ARRAY critical_tables
  LOOP
    SELECT c.relrowsecurity INTO has_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = table_name AND n.nspname = 'public';
    
    total_tables := total_tables + 1;
    
    IF has_rls THEN
      rls_tables := rls_tables + 1;
    ELSE
      missing_rls := array_append(missing_rls, table_name);
    END IF;
  END LOOP;
  
  result := jsonb_build_object(
    'tables_with_rls', rls_tables,
    'total_critical_tables', total_tables,
    'missing_rls_tables', array_to_json(missing_rls),
    'rls_coverage_percent', CASE 
      WHEN total_tables > 0 THEN ROUND((rls_tables::decimal / total_tables * 100), 1)
      ELSE 0 
    END,
    'compliant', rls_tables = total_tables
  );
  
  RETURN result;
END;
$$;

-- 3. Create production readiness assessment function
CREATE OR REPLACE FUNCTION public.assess_production_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_health jsonb;
  rls_status jsonb;
  business_config jsonb;
  overall_score numeric := 0;
  issues text[] := '{}';
  warnings text[] := '{}';
  recommendations text[] := '{}';
BEGIN
  -- Get authentication health
  auth_health := check_auth_health();
  
  -- Get RLS status
  rls_status := check_rls_status();
  
  -- Check business configuration
  SELECT jsonb_build_object(
    'name_configured', CASE WHEN name IS NOT NULL AND name != '' THEN true ELSE false END,
    'admin_email_configured', CASE WHEN admin_notification_email IS NOT NULL THEN true ELSE false END,
    'logo_configured', CASE WHEN logo_url IS NOT NULL THEN true ELSE false END
  ) INTO business_config
  FROM business_settings
  LIMIT 1;
  
  -- Calculate overall score
  overall_score := (
    (auth_health->>'score')::numeric * 0.4 +
    CASE WHEN (rls_status->>'compliant')::boolean THEN 100 ELSE 0 END * 0.4 +
    CASE 
      WHEN (business_config->>'name_configured')::boolean AND (business_config->>'admin_email_configured')::boolean THEN 100
      WHEN (business_config->>'name_configured')::boolean OR (business_config->>'admin_email_configured')::boolean THEN 60
      ELSE 0
    END * 0.2
  );
  
  -- Collect issues and warnings
  IF NOT (auth_health->>'healthy')::boolean THEN
    issues := array_append(issues, 'Authentication system unhealthy');
  END IF;
  
  IF NOT (rls_status->>'compliant')::boolean THEN
    issues := array_append(issues, 'Critical tables missing RLS policies');
  END IF;
  
  IF NOT (business_config->>'name_configured')::boolean THEN
    issues := array_append(issues, 'Business name not configured');
  END IF;
  
  IF NOT (business_config->>'admin_email_configured')::boolean THEN
    issues := array_append(issues, 'Admin notification email not configured');
  END IF;
  
  -- Generate recommendations
  IF (auth_health->'metrics'->>'verification_rate')::numeric < 80 THEN
    recommendations := array_append(recommendations, 'Implement email verification reminders');
  END IF;
  
  IF array_length((rls_status->>'missing_rls_tables')::text[], 1) > 0 THEN
    recommendations := array_append(recommendations, 'Enable RLS on all critical tables');
  END IF;
  
  IF NOT (business_config->>'logo_configured')::boolean THEN
    recommendations := array_append(recommendations, 'Upload business logo for branding');
  END IF;
  
  RETURN jsonb_build_object(
    'ready_for_production', overall_score >= 80 AND array_length(issues, 1) = 0,
    'overall_score', ROUND(overall_score, 0),
    'component_scores', jsonb_build_object(
      'authentication', (auth_health->>'score')::numeric,
      'security', CASE WHEN (rls_status->>'compliant')::boolean THEN 100 ELSE 0 END,
      'configuration', CASE 
        WHEN (business_config->>'name_configured')::boolean AND (business_config->>'admin_email_configured')::boolean THEN 100
        WHEN (business_config->>'name_configured')::boolean OR (business_config->>'admin_email_configured')::boolean THEN 60
        ELSE 0
      END
    ),
    'auth_health', auth_health,
    'rls_status', rls_status,
    'business_config', business_config,
    'issues', array_to_json(COALESCE(issues, '{}'::text[])),
    'warnings', array_to_json(COALESCE(warnings, '{}'::text[])),
    'recommendations', array_to_json(COALESCE(recommendations, '{}'::text[])),
    'last_assessed', NOW()
  );
END;
$$;