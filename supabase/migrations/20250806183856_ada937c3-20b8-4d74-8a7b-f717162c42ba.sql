-- Fix RLS policies for payment verification and add production security
-- This addresses 403 errors and enhances security for production

-- First, ensure webhook_events table exists for webhook deduplication
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'paystack',
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processing_result JSONB,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on webhook_events
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for webhook_events (service role only)
CREATE POLICY "Service roles can manage webhook events" ON public.webhook_events
  FOR ALL USING (auth.role() = 'service_role');

-- Fix payment_transactions RLS to allow verification
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Service roles can manage payment transactions" ON public.payment_transactions;

-- Enhanced RLS for payment_transactions
CREATE POLICY "Users can view their own payment transactions" ON public.payment_transactions
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid() OR
      -- Allow access if user is associated with the order
      order_id IN (
        SELECT id FROM orders WHERE customer_id IN (
          SELECT id FROM customer_accounts WHERE user_id = auth.uid()
        )
      ) OR
      -- Allow access during checkout session
      metadata->>'session_user_id' = auth.uid()::text
    )
  );

CREATE POLICY "Service roles can manage all payment transactions" ON public.payment_transactions
  FOR ALL 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can create payment transactions" ON public.payment_transactions
  FOR INSERT 
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid() OR
      metadata->>'session_user_id' = auth.uid()::text
    )
  );

-- Fix orders RLS to allow access during payment verification
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Service roles can manage all orders" ON public.orders;

-- Enhanced RLS for orders
CREATE POLICY "Customers can view their own orders" ON public.orders
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL AND (
      customer_id IN (
        SELECT id FROM customer_accounts WHERE user_id = auth.uid()
      ) OR
      -- Allow access if user email matches order email (for guest orders)
      customer_email IN (
        SELECT email FROM auth.users WHERE id = auth.uid()
      ) OR
      -- Allow access during checkout/payment process
      guest_session_id IN (
        SELECT id FROM customer_accounts WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service roles can manage all orders" ON public.orders
  FOR ALL 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT 
  USING (is_admin());

-- Create production monitoring functions
CREATE OR REPLACE FUNCTION public.log_payment_verification_attempt(
  p_reference TEXT,
  p_user_id UUID DEFAULT NULL,
  p_success BOOLEAN DEFAULT FALSE,
  p_error_message TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    new_values
  ) VALUES (
    'payment_verification_attempt',
    'Payment Security',
    CASE 
      WHEN p_success THEN 'Payment verification successful: ' || p_reference
      ELSE 'Payment verification failed: ' || p_reference
    END,
    p_user_id,
    jsonb_build_object(
      'reference', p_reference,
      'success', p_success,
      'error_message', p_error_message,
      'ip_address', p_ip_address,
      'timestamp', NOW()
    )
  );
END;
$$;

-- Enhanced payment status tracking
CREATE TABLE IF NOT EXISTS public.payment_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL,
  user_id UUID,
  verification_attempt INTEGER DEFAULT 1,
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_verification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service roles can manage verification logs" ON public.payment_verification_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view verification logs" ON public.payment_verification_logs
  FOR SELECT USING (is_admin());

-- Production configuration table for environment settings
CREATE TABLE IF NOT EXISTS public.production_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL DEFAULT 'development',
  is_live_mode BOOLEAN DEFAULT FALSE,
  webhook_url TEXT,
  allowed_origins TEXT[],
  security_config JSONB DEFAULT '{}',
  rate_limits JSONB DEFAULT '{}',
  monitoring_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.production_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage production config" ON public.production_config
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Service roles can read production config" ON public.production_config
  FOR SELECT USING (auth.role() = 'service_role');

-- Insert default production configuration
INSERT INTO public.production_config (
  environment,
  is_live_mode,
  webhook_url,
  allowed_origins,
  security_config,
  rate_limits
) VALUES (
  'development',
  FALSE,
  'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/paystack-webhook-secure',
  ARRAY['https://oknnklksdiqaifhxaccs.supabase.co', 'http://localhost:8080'],
  jsonb_build_object(
    'require_signature_verification', true,
    'validate_ip_whitelist', false,
    'max_webhook_age_minutes', 5,
    'enable_replay_protection', true
  ),
  jsonb_build_object(
    'verification_per_minute', 10,
    'verification_per_hour', 50,
    'webhook_per_minute', 100
  )
) ON CONFLICT DO NOTHING;

-- Function to check if system is ready for production
CREATE OR REPLACE FUNCTION public.check_production_readiness()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result JSONB := '{}';
  v_paystack_config RECORD;
  v_webhook_secret_set BOOLEAN := FALSE;
  v_live_keys_set BOOLEAN := FALSE;
  v_webhook_url_set BOOLEAN := FALSE;
  v_score INTEGER := 0;
  v_issues TEXT[] := '{}';
BEGIN
  -- Check Paystack configuration
  SELECT * INTO v_paystack_config
  FROM payment_integrations 
  WHERE provider = 'paystack' 
  AND connection_status = 'connected'
  ORDER BY updated_at DESC 
  LIMIT 1;
  
  IF v_paystack_config IS NULL THEN
    v_issues := array_append(v_issues, 'Paystack integration not configured');
  ELSE
    -- Check webhook secret
    IF v_paystack_config.webhook_secret IS NOT NULL AND length(v_paystack_config.webhook_secret) > 0 THEN
      v_webhook_secret_set := TRUE;
      v_score := v_score + 25;
    ELSE
      v_issues := array_append(v_issues, 'Webhook secret not configured');
    END IF;
    
    -- Check live keys
    IF v_paystack_config.live_public_key IS NOT NULL AND v_paystack_config.live_secret_key IS NOT NULL THEN
      v_live_keys_set := TRUE;
      v_score := v_score + 25;
    ELSE
      v_issues := array_append(v_issues, 'Live API keys not configured');
    END IF;
  END IF;
  
  -- Check webhook URL configuration
  IF EXISTS (SELECT 1 FROM production_config WHERE webhook_url IS NOT NULL) THEN
    v_webhook_url_set := TRUE;
    v_score := v_score + 20;
  ELSE
    v_issues := array_append(v_issues, 'Webhook URL not configured');
  END IF;
  
  -- Check security configurations
  IF EXISTS (SELECT 1 FROM production_config WHERE security_config ? 'require_signature_verification') THEN
    v_score := v_score + 15;
  END IF;
  
  -- Check monitoring setup
  IF EXISTS (SELECT 1 FROM production_config WHERE monitoring_enabled = TRUE) THEN
    v_score := v_score + 15;
  END IF;
  
  v_result := jsonb_build_object(
    'ready_for_production', (v_score >= 80 AND array_length(v_issues, 1) = 0),
    'score', v_score,
    'webhook_secret_configured', v_webhook_secret_set,
    'live_keys_configured', v_live_keys_set,
    'webhook_url_configured', v_webhook_url_set,
    'issues', v_issues,
    'last_checked', NOW()
  );
  
  RETURN v_result;
END;
$$;

-- Update triggers for production_config
CREATE OR REPLACE FUNCTION public.update_production_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_production_config_updated_at ON public.production_config;
CREATE TRIGGER update_production_config_updated_at
  BEFORE UPDATE ON public.production_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_production_config_timestamp();