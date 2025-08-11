-- Create missing RPC functions for production readiness checks

-- Function to check Paystack production readiness
CREATE OR REPLACE FUNCTION public.check_paystack_production_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config RECORD;
  v_score INTEGER := 0;
  v_issues TEXT[] := '{}';
  v_warnings TEXT[] := '{}';
  v_ready BOOLEAN := false;
BEGIN
  -- Get active Paystack configuration
  SELECT * INTO v_config
  FROM payment_integrations 
  WHERE provider = 'paystack' 
    AND is_active = true 
  LIMIT 1;
  
  IF NOT FOUND THEN
    v_issues := array_append(v_issues, 'No active Paystack configuration found');
    RETURN jsonb_build_object(
      'ready_for_production', false,
      'score', 0,
      'issues', v_issues,
      'warnings', v_warnings
    );
  END IF;
  
  -- Check if public key exists
  IF v_config.config ? 'public_key' AND LENGTH(v_config.config->>'public_key') > 0 THEN
    v_score := v_score + 25;
  ELSE
    v_issues := array_append(v_issues, 'Paystack public key not configured');
  END IF;
  
  -- Check if secret key exists
  IF v_config.config ? 'secret_key' AND LENGTH(v_config.config->>'secret_key') > 0 THEN
    v_score := v_score + 25;
  ELSE
    v_issues := array_append(v_issues, 'Paystack secret key not configured');
  END IF;
  
  -- Check if webhook secret exists
  IF v_config.config ? 'webhook_secret' AND LENGTH(v_config.config->>'webhook_secret') > 0 THEN
    v_score := v_score + 25;
  ELSE
    v_issues := array_append(v_issues, 'Paystack webhook secret not configured');
  END IF;
  
  -- Check environment mode
  IF v_config.config ? 'test_mode' THEN
    IF (v_config.config->>'test_mode')::boolean = false THEN
      v_score := v_score + 25;
    ELSE
      v_warnings := array_append(v_warnings, 'Paystack is in test mode');
      v_score := v_score + 10;
    END IF;
  ELSE
    v_issues := array_append(v_issues, 'Paystack environment mode not specified');
  END IF;
  
  -- Determine if ready for production
  v_ready := v_score >= 90 AND array_length(v_issues, 1) IS NULL;
  
  RETURN jsonb_build_object(
    'ready_for_production', v_ready,
    'score', v_score,
    'issues', v_issues,
    'warnings', v_warnings
  );
END;
$$;

-- Function to check general production readiness
CREATE OR REPLACE FUNCTION public.check_production_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_score INTEGER := 0;
  v_issues TEXT[] := '{}';
  v_warnings TEXT[] := '{}';
  v_ready BOOLEAN := false;
  v_table_count INTEGER;
  v_orders_count INTEGER;
  v_business_settings_count INTEGER;
BEGIN
  -- Check if core tables exist and have data
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('orders', 'products', 'business_settings', 'payment_transactions');
  
  IF v_table_count = 4 THEN
    v_score := v_score + 20;
  ELSE
    v_issues := array_append(v_issues, 'Core database tables missing');
  END IF;
  
  -- Check if business settings are configured
  SELECT COUNT(*) INTO v_business_settings_count FROM business_settings;
  IF v_business_settings_count > 0 THEN
    v_score := v_score + 20;
  ELSE
    v_issues := array_append(v_issues, 'Business settings not configured');
  END IF;
  
  -- Check if there are orders (indicates system is being used)
  SELECT COUNT(*) INTO v_orders_count FROM orders;
  IF v_orders_count > 0 THEN
    v_score := v_score + 15;
  ELSE
    v_warnings := array_append(v_warnings, 'No orders found - system has not been tested');
  END IF;
  
  -- Check if RLS is enabled on sensitive tables
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename = 'orders' 
      AND rowsecurity = true
  ) THEN
    v_score := v_score + 15;
  ELSE
    v_issues := array_append(v_issues, 'Row Level Security not enabled on orders table');
  END IF;
  
  -- Check if audit logging is set up
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    v_score := v_score + 10;
  ELSE
    v_warnings := array_append(v_warnings, 'Audit logging table not found');
  END IF;
  
  -- Check if communication settings exist
  IF EXISTS (SELECT 1 FROM communication_settings) THEN
    v_score := v_score + 10;
  ELSE
    v_warnings := array_append(v_warnings, 'Communication settings not configured');
  END IF;
  
  -- Check if products exist
  IF EXISTS (SELECT 1 FROM products WHERE is_active = true) THEN
    v_score := v_score + 10;
  ELSE
    v_issues := array_append(v_issues, 'No active products found');
  END IF;
  
  -- Determine if ready for production
  v_ready := v_score >= 80 AND array_length(v_issues, 1) IS NULL;
  
  RETURN jsonb_build_object(
    'ready_for_production', v_ready,
    'score', v_score,
    'issues', v_issues,
    'warnings', v_warnings
  );
END;
$$;

-- Function to get production health status
CREATE OR REPLACE FUNCTION public.get_production_health_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_database_status TEXT := 'healthy';
  v_payment_status TEXT := 'healthy';
  v_email_status TEXT := 'healthy';
  v_overall_status TEXT := 'healthy';
  v_issues TEXT[] := '{}';
  v_orders_last_24h INTEGER;
  v_failed_payments_last_24h INTEGER;
  v_failed_emails_last_24h INTEGER;
BEGIN
  -- Check database health by testing basic operations
  BEGIN
    SELECT COUNT(*) INTO v_orders_last_24h
    FROM orders
    WHERE created_at > NOW() - INTERVAL '24 hours';
  EXCEPTION
    WHEN OTHERS THEN
      v_database_status := 'critical';
      v_issues := array_append(v_issues, 'Database connection failed');
  END;
  
  -- Check payment system health
  SELECT COUNT(*) INTO v_failed_payments_last_24h
  FROM payment_transactions
  WHERE created_at > NOW() - INTERVAL '24 hours'
    AND status IN ('failed', 'error');
  
  IF v_failed_payments_last_24h > 10 THEN
    v_payment_status := 'degraded';
    v_issues := array_append(v_issues, 'High payment failure rate detected');
  ELSIF v_failed_payments_last_24h > 25 THEN
    v_payment_status := 'critical';
    v_issues := array_append(v_issues, 'Critical payment failure rate');
  END IF;
  
  -- Check email system health
  SELECT COUNT(*) INTO v_failed_emails_last_24h
  FROM communication_events
  WHERE created_at > NOW() - INTERVAL '24 hours'
    AND status = 'failed';
  
  IF v_failed_emails_last_24h > 20 THEN
    v_email_status := 'degraded';
    v_issues := array_append(v_issues, 'High email failure rate detected');
  ELSIF v_failed_emails_last_24h > 50 THEN
    v_email_status := 'critical';
    v_issues := array_append(v_issues, 'Critical email failure rate');
  END IF;
  
  -- Determine overall status
  IF v_database_status = 'critical' OR v_payment_status = 'critical' OR v_email_status = 'critical' THEN
    v_overall_status := 'critical';
  ELSIF v_database_status = 'degraded' OR v_payment_status = 'degraded' OR v_email_status = 'degraded' THEN
    v_overall_status := 'degraded';
  END IF;
  
  RETURN jsonb_build_object(
    'overall_status', v_overall_status,
    'database_status', v_database_status,
    'payment_status', v_payment_status,
    'email_status', v_email_status,
    'orders_last_24h', v_orders_last_24h,
    'failed_payments_last_24h', v_failed_payments_last_24h,
    'failed_emails_last_24h', v_failed_emails_last_24h,
    'issues', v_issues,
    'timestamp', NOW()
  );
END;
$$;