-- Production Paystack Configuration Migration
-- This migration sets up the live production environment for Paystack

-- Update environment configuration to live mode
INSERT INTO public.environment_config (key, value, environment, description, is_secure, created_at, updated_at)
VALUES 
  ('PAYSTACK_MODE', 'live', 'production', 'Paystack payment mode - live for production', false, now(), now()),
  ('WEBHOOK_URL', 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/enhanced-paystack-webhook', 'production', 'Production webhook URL for Paystack', false, now(), now()),
  ('FORCE_LIVE_MODE', 'true', 'production', 'Force live mode regardless of domain detection', false, now(), now())
ON CONFLICT (key, environment) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- Update or insert Paystack secure configuration for production
INSERT INTO public.paystack_secure_config (
  test_mode, 
  is_active, 
  webhook_url, 
  environment_mode,
  created_at,
  updated_at
) VALUES (
  false, -- Live mode
  true,  -- Active
  'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/enhanced-paystack-webhook',
  'production',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  test_mode = false,
  is_active = true,
  webhook_url = 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/enhanced-paystack-webhook',
  environment_mode = 'production',
  updated_at = now();

-- Create production health monitoring table
CREATE TABLE IF NOT EXISTS public.production_health_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_type TEXT NOT NULL DEFAULT 'counter',
  environment TEXT NOT NULL DEFAULT 'production',
  dimensions JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on production health metrics
ALTER TABLE public.production_health_metrics ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view production metrics
CREATE POLICY "Admins can view production metrics" ON public.production_health_metrics
  FOR SELECT USING (is_admin());

-- Create policy for service role to insert metrics
CREATE POLICY "Service role can insert production metrics" ON public.production_health_metrics
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Create function to log production metrics
CREATE OR REPLACE FUNCTION log_production_metric(
  p_metric_name TEXT,
  p_metric_value NUMERIC,
  p_metric_type TEXT DEFAULT 'counter',
  p_dimensions JSONB DEFAULT '{}'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO production_health_metrics (
    metric_name, 
    metric_value, 
    metric_type, 
    dimensions
  ) VALUES (
    p_metric_name, 
    p_metric_value, 
    p_metric_type, 
    p_dimensions
  );
END;
$$;

-- Create payment monitoring view
CREATE OR REPLACE VIEW payment_success_metrics AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_payments,
  COUNT(*) FILTER (WHERE status = 'successful') as successful_payments,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_payments,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'successful')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
    2
  ) as success_rate_percent
FROM payment_transactions 
WHERE created_at > now() - interval '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- Grant access to the view for admins
GRANT SELECT ON payment_success_metrics TO authenticated;

-- Create function to get live payment status
CREATE OR REPLACE FUNCTION get_live_payment_status() 
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  total_payments INTEGER;
  successful_payments INTEGER;
  failed_payments INTEGER;
  success_rate NUMERIC;
BEGIN
  -- Only allow admins or service role to access this
  IF NOT (is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Get payment statistics for last 24 hours
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'successful'),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO total_payments, successful_payments, failed_payments
  FROM payment_transactions 
  WHERE created_at > now() - interval '24 hours';
  
  -- Calculate success rate
  success_rate := CASE 
    WHEN total_payments > 0 THEN 
      ROUND((successful_payments::NUMERIC / total_payments) * 100, 2)
    ELSE 0 
  END;

  result := jsonb_build_object(
    'total_payments', total_payments,
    'successful_payments', successful_payments,
    'failed_payments', failed_payments,
    'success_rate', success_rate,
    'is_live_mode', true,
    'last_updated', now(),
    'environment', 'production'
  );

  RETURN result;
END;
$$;