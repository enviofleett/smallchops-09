-- PHASE 1: CRITICAL SECURITY FIXES FOR PRODUCTION LAUNCH
-- Fix all RLS disabled tables and secure database functions

-- Enable RLS on publicly accessible tables that contain sensitive business data
ALTER TABLE public.delivery_zones_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_fees_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_consolidation_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones_migration_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zone_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_flow_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_metrics ENABLE ROW LEVEL SECURITY;

-- Create admin-only access policies for sensitive business data
CREATE POLICY "Admin only access to delivery zones backup" ON public.delivery_zones_backup
  FOR ALL USING (is_admin());

CREATE POLICY "Admin only access to delivery fees backup" ON public.delivery_fees_backup
  FOR ALL USING (is_admin());

CREATE POLICY "Admin only access to zone consolidation map" ON public.zone_consolidation_map
  FOR ALL USING (is_admin());

CREATE POLICY "Admin only access to migration summary" ON public.delivery_zones_migration_summary
  FOR ALL USING (is_admin());

CREATE POLICY "Admin only access to zone monitoring" ON public.delivery_zone_monitoring
  FOR ALL USING (is_admin());

CREATE POLICY "Admin only access to payment system health" ON public.payment_system_health
  FOR ALL USING (is_admin());

CREATE POLICY "Admin only access to payment flow health" ON public.payment_flow_health
  FOR ALL USING (is_admin());

CREATE POLICY "Admin only access to production metrics" ON public.production_metrics
  FOR ALL USING (is_admin());

-- Secure database functions by adding proper search paths
CREATE OR REPLACE FUNCTION public.calculate_delivery_metrics(p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update delivery analytics for the specified date
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

-- Update existing functions to include proper search paths
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

-- Create secure function to check production readiness
CREATE OR REPLACE FUNCTION public.check_production_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  readiness_score integer := 0;
  max_score integer := 100;
  issues text[] := '{}';
  warnings text[] := '{}';
  
  -- Check counts
  product_count integer;
  order_count integer;
  customer_count integer;
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

  -- Check if we have products
  SELECT COUNT(*) INTO product_count FROM products WHERE is_active = true;
  IF product_count >= 5 THEN
    readiness_score := readiness_score + 20;
  ELSE
    issues := array_append(issues, 'Need at least 5 active products (current: ' || product_count || ')');
  END IF;

  -- Check if we have admin users
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

  -- Check categories
  IF EXISTS (SELECT 1 FROM categories WHERE is_active = true LIMIT 1) THEN
    readiness_score := readiness_score + 10;
  ELSE
    issues := array_append(issues, 'No active product categories');
  END IF;

  -- Security checks
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname LIKE '%customer%') THEN
    issues := array_append(issues, 'Orders table missing customer access policies');
  ELSE
    readiness_score := readiness_score + 10;
  END IF;

  -- Check if we have pickup points or delivery zones
  IF NOT EXISTS (SELECT 1 FROM pickup_points WHERE is_active = true) 
     AND NOT EXISTS (SELECT 1 FROM delivery_zones WHERE is_active = true) THEN
    issues := array_append(issues, 'Need either active pickup points or delivery zones');
  ELSE
    readiness_score := readiness_score + 10;
  END IF;

  RETURN jsonb_build_object(
    'ready_for_production', array_length(issues, 1) IS NULL AND readiness_score >= 80,
    'score', readiness_score,
    'issues', issues,
    'warnings', warnings,
    'checks_completed_at', NOW()
  );
END;
$function$;

-- Create function to check Paystack production readiness
CREATE OR REPLACE FUNCTION public.check_paystack_production_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  readiness_score integer := 0;
  max_score integer := 100;
  issues text[] := '{}';
  warnings text[] := '{}';
  config_exists boolean := false;
  has_live_keys boolean := false;
  has_webhook_secret boolean := false;
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

  -- This is a placeholder for Paystack configuration checks
  -- In production, you would check if Paystack secrets are configured
  -- Since we can't access secrets directly, we'll return a warning
  
  warnings := array_append(warnings, 'Paystack production configuration needs manual verification');
  warnings := array_append(warnings, 'Verify PAYSTACK_SECRET_KEY is set to live key');
  warnings := array_append(warnings, 'Verify PAYSTACK_PUBLIC_KEY is set to live key');
  warnings := array_append(warnings, 'Verify webhook URL is configured in Paystack dashboard');
  
  readiness_score := 60; -- Partial score due to inability to verify secrets

  RETURN jsonb_build_object(
    'ready_for_production', false,
    'score', readiness_score,
    'issues', ARRAY['Manual verification of Paystack configuration required'],
    'warnings', warnings,
    'checks_completed_at', NOW()
  );
END;
$function$;