-- Fix function search_path security warnings and database functions
-- Drop existing function to recreate with correct signature
DROP FUNCTION IF EXISTS public.get_active_paystack_config();

-- Recreate with proper return type
CREATE OR REPLACE FUNCTION public.get_active_paystack_config()
RETURNS TABLE(
  public_key text,
  test_mode boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN pi.test_mode THEN pi.public_key 
      ELSE COALESCE(pi.live_public_key, pi.public_key)
    END as public_key,
    COALESCE(pi.test_mode, true) as test_mode
  FROM public.payment_integrations pi
  WHERE pi.provider = 'paystack' 
    AND pi.connection_status = 'connected'
  ORDER BY pi.updated_at DESC
  LIMIT 1;
END;
$$;

-- Fix search_path for update_updated_at_column function
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- Create rate limiting table for production readiness
CREATE TABLE IF NOT EXISTS public.payment_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  ip_address text,
  operation_type text NOT NULL DEFAULT 'payment',
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create payment error tracking for production monitoring
CREATE TABLE IF NOT EXISTS public.payment_error_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_code text NOT NULL,
  error_message text NOT NULL,
  error_context jsonb DEFAULT '{}',
  user_id uuid,
  order_id uuid,
  transaction_reference text,
  severity text DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create production health monitoring
CREATE TABLE IF NOT EXISTS public.payment_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  metric_unit text DEFAULT 'count',
  metadata jsonb DEFAULT '{}',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.payment_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_error_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_health_metrics ENABLE ROW LEVEL SECURITY;

-- Create admin-only policies for monitoring tables
CREATE POLICY "Admin only access to rate limits"
  ON public.payment_rate_limits
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin only access to error tracking"
  ON public.payment_error_tracking
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin only access to health metrics"
  ON public.payment_health_metrics
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));