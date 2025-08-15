-- PHASE 1: CRITICAL SECURITY FIXES FOR PRODUCTION LAUNCH (CORRECTED)
-- Fix RLS for actual tables only, secure functions, and address critical issues

-- Enable RLS on backup tables (these are actual tables)
ALTER TABLE public.delivery_zones_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_fees_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_consolidation_map ENABLE ROW LEVEL SECURITY;

-- Create admin-only access policies for backup tables
CREATE POLICY "Admin only access to delivery zones backup" ON public.delivery_zones_backup
  FOR ALL USING (is_admin());

CREATE POLICY "Admin only access to delivery fees backup" ON public.delivery_fees_backup
  FOR ALL USING (is_admin());

CREATE POLICY "Admin only access to zone consolidation map" ON public.zone_consolidation_map
  FOR ALL USING (is_admin());

-- Secure all functions with proper search paths
CREATE OR REPLACE FUNCTION public.calculate_delivery_metrics(p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'delivered') as completed_deliveries,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_deliveries,
    COALESCE(SUM(delivery_fee), 0) as total_delivery_fees,
    AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))/60) FILTER (WHERE delivered_at IS NOT NULL) as avg_time
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
$function$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_sequence_value bigint;
  order_number text;
BEGIN
  SELECT nextval('order_number_seq') INTO next_sequence_value;
  order_number := 'ST' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(next_sequence_value::text, 6, '0');
  RETURN order_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_admin_access()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin' 
    AND is_active = true
  );
$function$;

-- Update log_customer_operation function
CREATE OR REPLACE FUNCTION public.log_customer_operation(
  p_action text,
  p_customer_id uuid,
  p_metadata jsonb DEFAULT '{}',
  p_admin_id uuid DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    p_action,
    'Customer Management',
    'Customer operation: ' || p_action,
    COALESCE(p_admin_id, auth.uid()),
    p_customer_id,
    p_metadata,
    p_ip_address::text,
    p_user_agent
  );
END;
$function$;

-- Create production readiness checker
CREATE OR REPLACE FUNCTION public.check_production_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  readiness_score integer := 0;
  issues text[] := '{}';
  warnings text[] := '{}';
  product_count integer;
  admin_count integer;
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'ready_for_production', false,
      'score', 0,
      'issues', ARRAY['Access denied - admin privileges required'],
      'warnings', ARRAY[]::text[]
    );
  END IF;

  -- Check products
  SELECT COUNT(*) INTO product_count FROM products WHERE is_active = true;
  IF product_count >= 5 THEN
    readiness_score := readiness_score + 20;
  ELSE
    issues := array_append(issues, 'Need at least 5 active products (current: ' || product_count || ')');
  END IF;

  -- Check admin users
  SELECT COUNT(*) INTO admin_count FROM profiles WHERE role = 'admin' AND is_active = true;
  IF admin_count >= 1 THEN
    readiness_score := readiness_score + 15;
  ELSE
    issues := array_append(issues, 'Need at least 1 active admin user');
  END IF;

  -- Check delivery zones
  IF EXISTS (SELECT 1 FROM delivery_zones WHERE is_active = true LIMIT 1) THEN
    readiness_score := readiness_score + 15;
  ELSE
    issues := array_append(issues, 'No active delivery zones configured');
  END IF;

  -- Check categories
  IF EXISTS (SELECT 1 FROM categories WHERE is_active = true LIMIT 1) THEN
    readiness_score := readiness_score + 10;
  ELSE
    issues := array_append(issues, 'No active product categories');
  END IF;

  -- Check pickup points or delivery zones
  IF NOT EXISTS (SELECT 1 FROM pickup_points WHERE is_active = true) 
     AND NOT EXISTS (SELECT 1 FROM delivery_zones WHERE is_active = true) THEN
    issues := array_append(issues, 'Need either active pickup points or delivery zones');
  ELSE
    readiness_score := readiness_score + 10;
  END IF;

  -- Check business settings
  IF EXISTS (SELECT 1 FROM business_settings LIMIT 1) THEN
    readiness_score := readiness_score + 10;
  ELSE
    warnings := array_append(warnings, 'Business settings not configured');
  END IF;

  -- Check email templates
  IF EXISTS (SELECT 1 FROM enhanced_email_templates WHERE is_active = true LIMIT 1) THEN
    readiness_score := readiness_score + 10;
  ELSE
    warnings := array_append(warnings, 'No email templates configured');
  END IF;

  -- Additional 10 points for having the basics
  readiness_score := readiness_score + 10;

  RETURN jsonb_build_object(
    'ready_for_production', array_length(issues, 1) IS NULL AND readiness_score >= 80,
    'score', readiness_score,
    'issues', issues,
    'warnings', warnings,
    'checks_completed_at', NOW()
  );
END;
$function$;

-- Create Paystack production readiness checker
CREATE OR REPLACE FUNCTION public.check_paystack_production_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  readiness_score integer := 60;
  issues text[] := '{}';
  warnings text[] := '{}';
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'ready_for_production', false,
      'score', 0,
      'issues', ARRAY['Access denied - admin privileges required'],
      'warnings', ARRAY[]::text[]
    );
  END IF;

  -- Add manual verification requirements
  issues := array_append(issues, 'Manual verification of Paystack configuration required');
  warnings := array_append(warnings, 'Verify PAYSTACK_SECRET_KEY is set to live key');
  warnings := array_append(warnings, 'Verify PAYSTACK_PUBLIC_KEY is set to live key');
  warnings := array_append(warnings, 'Verify webhook URL is configured in Paystack dashboard');
  warnings := array_append(warnings, 'Test payment flows in live mode');

  RETURN jsonb_build_object(
    'ready_for_production', false,
    'score', readiness_score,
    'issues', issues,
    'warnings', warnings,
    'checks_completed_at', NOW()
  );
END;
$function$;