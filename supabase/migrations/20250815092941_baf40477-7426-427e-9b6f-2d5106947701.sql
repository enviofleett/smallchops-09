-- Fix remaining security issues: Add search_path to all SECURITY DEFINER functions

-- Fix functions missing search_path
CREATE OR REPLACE FUNCTION public.calculate_delivery_metrics(p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert or update daily metrics
  INSERT INTO delivery_analytics (
    date,
    total_deliveries,
    completed_deliveries,
    failed_deliveries,
    total_delivery_fees,
    average_delivery_time_minutes
  )
  SELECT 
    p_date,
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'delivered'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COALESCE(SUM(delivery_fee), 0),
    COALESCE(AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))/60), 0)
  FROM orders
  WHERE DATE(created_at) = p_date
    AND order_type = 'delivery'
  ON CONFLICT (date) DO UPDATE SET
    total_deliveries = EXCLUDED.total_deliveries,
    completed_deliveries = EXCLUDED.completed_deliveries,
    failed_deliveries = EXCLUDED.failed_deliveries,
    total_delivery_fees = EXCLUDED.total_delivery_fees,
    average_delivery_time_minutes = EXCLUDED.average_delivery_time_minutes,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.jwt() ->> 'email';
$$;

CREATE OR REPLACE FUNCTION public.get_current_logo()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT logo_url FROM logo_versions WHERE is_current = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.log_customer_operation(
  p_operation text,
  p_customer_id uuid,
  p_changes jsonb DEFAULT '{}',
  p_admin_id uuid DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    'customer_' || p_operation,
    'Customer Management',
    'Customer operation: ' || p_operation,
    COALESCE(p_admin_id, auth.uid()),
    p_customer_id,
    p_changes,
    p_ip_address::text,
    p_user_agent
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_admin_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin' 
    AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.check_paystack_production_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  issues text[] := '{}';
  warnings text[] := '{}';
  score integer := 100;
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  -- Check for Paystack configuration
  IF NOT EXISTS (SELECT 1 FROM payment_integrations WHERE provider = 'paystack') THEN
    issues := array_append(issues, 'Paystack integration not configured');
    score := score - 50;
  END IF;

  -- Check recent payment activity
  IF NOT EXISTS (
    SELECT 1 FROM payment_transactions 
    WHERE created_at > NOW() - INTERVAL '24 hours'
  ) THEN
    warnings := array_append(warnings, 'No recent payment activity');
    score := score - 10;
  END IF;

  result := jsonb_build_object(
    'ready_for_production', array_length(issues, 1) = 0,
    'score', score,
    'issues', issues,
    'warnings', warnings,
    'checked_at', NOW()
  );

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_production_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  issues text[] := '{}';
  warnings text[] := '{}';
  score integer := 100;
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  -- Check if there are products
  IF NOT EXISTS (SELECT 1 FROM products WHERE is_available = true) THEN
    issues := array_append(issues, 'No available products');
    score := score - 30;
  END IF;

  -- Check if there are categories
  IF NOT EXISTS (SELECT 1 FROM categories WHERE is_active = true) THEN
    warnings := array_append(warnings, 'No active categories');
    score := score - 10;
  END IF;

  result := jsonb_build_object(
    'ready_for_production', array_length(issues, 1) = 0,
    'score', score,
    'issues', issues,
    'warnings', warnings,
    'checked_at', NOW()
  );

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_production_health_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  health_data RECORD;
  result jsonb;
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  SELECT * INTO health_data FROM payment_system_health LIMIT 1;
  
  IF health_data IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'unknown',
      'message', 'No health data available'
    );
  END IF;
  
  result := jsonb_build_object(
    'status', health_data.health_status,
    'success_rate', health_data.success_rate_percent,
    'total_transactions', health_data.total_transactions,
    'last_transaction', health_data.last_transaction_time,
    'calculated_at', health_data.calculated_at
  );
  
  RETURN result;
END;
$$;