-- Phase 1: Critical Security Fixes for Paystack Integration

-- Fix database function security vulnerabilities
-- Update functions to use explicit search_path and remove security definer where appropriate

-- 1. Fix get_active_paystack_config function security
DROP FUNCTION IF EXISTS public.get_active_paystack_config();
CREATE OR REPLACE FUNCTION public.get_active_paystack_config()
RETURNS TABLE(public_key text, secret_key text, webhook_secret text, test_mode boolean, environment text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  env_config RECORD;
BEGIN
  -- Get current environment configuration
  SELECT * INTO env_config FROM public.get_environment_config() LIMIT 1;
  
  -- Return appropriate keys based on environment
  RETURN QUERY
  SELECT 
    CASE 
      WHEN COALESCE(env_config.is_live_mode, false) = true 
      THEN COALESCE(pi.live_public_key, pi.public_key)
      ELSE pi.public_key
    END as public_key,
    CASE 
      WHEN COALESCE(env_config.is_live_mode, false) = true 
      THEN COALESCE(pi.live_secret_key, pi.secret_key)
      ELSE pi.secret_key
    END as secret_key,
    CASE 
      WHEN COALESCE(env_config.is_live_mode, false) = true 
      THEN COALESCE(pi.live_webhook_secret, pi.webhook_secret)
      ELSE pi.webhook_secret
    END as webhook_secret,
    NOT COALESCE(env_config.is_live_mode, false) as test_mode,
    COALESCE(env_config.environment, 'development') as environment
  FROM public.payment_integrations pi
  WHERE pi.provider = 'paystack' 
    AND pi.connection_status = 'connected'
  ORDER BY pi.updated_at DESC
  LIMIT 1;
END;
$$;

-- 2. Fix get_environment_config function security
DROP FUNCTION IF EXISTS public.get_environment_config();
CREATE OR REPLACE FUNCTION public.get_environment_config()
RETURNS TABLE(environment text, is_live_mode boolean, webhook_url text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ec.environment,
    ec.is_live_mode,
    ec.webhook_url
  FROM public.environment_config ec
  ORDER BY ec.created_at DESC
  LIMIT 1;
END;
$$;

-- 3. Create secure webhook IP validation function
CREATE OR REPLACE FUNCTION public.validate_paystack_webhook_ip(request_ip inet)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  allowed_ips inet[] := ARRAY[
    '52.31.139.75'::inet,
    '52.49.173.169'::inet,
    '52.214.14.220'::inet,
    '54.154.89.105'::inet,
    '54.154.151.138'::inet,
    '54.217.79.138'::inet
  ];
  ip inet;
BEGIN
  -- Allow localhost for development
  IF request_ip <<= '127.0.0.0/8'::inet OR request_ip <<= '::1'::inet THEN
    RETURN true;
  END IF;
  
  -- Check against Paystack's official IP ranges
  FOREACH ip IN ARRAY allowed_ips LOOP
    IF request_ip = ip THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$;

-- 4. Create enhanced payment security audit function
CREATE OR REPLACE FUNCTION public.log_payment_security_event(
  event_type text,
  severity text DEFAULT 'medium',
  details jsonb DEFAULT '{}',
  ip_address inet DEFAULT NULL,
  user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  event_id uuid;
BEGIN
  INSERT INTO public.security_incidents (
    incident_type,
    severity,
    ip_address,
    user_agent,
    details,
    created_at
  ) VALUES (
    event_type,
    severity,
    ip_address,
    user_agent,
    details || jsonb_build_object('payment_related', true),
    NOW()
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$;

-- 5. Create production readiness check function
CREATE OR REPLACE FUNCTION public.check_paystack_production_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb := '{}';
  config_count integer;
  env_config RECORD;
  issues text[] := '{}';
  warnings text[] := '{}';
  score integer := 100;
BEGIN
  -- Check if Paystack integration exists
  SELECT COUNT(*) INTO config_count 
  FROM public.payment_integrations 
  WHERE provider = 'paystack';
  
  IF config_count = 0 THEN
    issues := array_append(issues, 'No Paystack integration configured');
    score := score - 50;
  END IF;
  
  -- Check environment configuration
  SELECT * INTO env_config FROM public.get_environment_config() LIMIT 1;
  
  IF env_config IS NULL THEN
    issues := array_append(issues, 'No environment configuration found');
    score := score - 30;
  ELSIF env_config.is_live_mode = false THEN
    warnings := array_append(warnings, 'Currently in test mode - switch to live for production');
    score := score - 10;
  END IF;
  
  -- Check for live keys when in live mode
  IF env_config.is_live_mode = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.payment_integrations 
      WHERE provider = 'paystack' 
        AND live_public_key IS NOT NULL 
        AND live_secret_key IS NOT NULL
        AND live_webhook_secret IS NOT NULL
    ) THEN
      issues := array_append(issues, 'Live mode enabled but live API keys not configured');
      score := score - 40;
    END IF;
  END IF;
  
  -- Check webhook configuration
  IF env_config.webhook_url IS NULL OR env_config.webhook_url = '' THEN
    issues := array_append(issues, 'Webhook URL not configured');
    score := score - 20;
  END IF;
  
  result := jsonb_build_object(
    'ready_for_production', (array_length(issues, 1) IS NULL OR array_length(issues, 1) = 0),
    'score', GREATEST(score, 0),
    'issues', to_jsonb(issues),
    'warnings', to_jsonb(warnings),
    'last_checked', NOW(),
    'environment', COALESCE(env_config.environment, 'unknown'),
    'live_mode', COALESCE(env_config.is_live_mode, false)
  );
  
  RETURN result;
END;
$$;

-- 6. Add proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(provider_reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_incidents_type_severity ON security_incidents(incident_type, severity);

-- 7. Add environment config table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.environment_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL DEFAULT 'development',
  is_live_mode boolean NOT NULL DEFAULT false,
  webhook_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS on environment_config
ALTER TABLE public.environment_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for environment_config
CREATE POLICY "Admins can manage environment config" ON public.environment_config
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 8. Add missing columns to payment_integrations if they don't exist
DO $$
BEGIN
  -- Add live API key columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_integrations' AND column_name = 'live_public_key') THEN
    ALTER TABLE public.payment_integrations ADD COLUMN live_public_key text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_integrations' AND column_name = 'live_secret_key') THEN
    ALTER TABLE public.payment_integrations ADD COLUMN live_secret_key text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_integrations' AND column_name = 'live_webhook_secret') THEN
    ALTER TABLE public.payment_integrations ADD COLUMN live_webhook_secret text;
  END IF;
  
  -- Add security tracking columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_integrations' AND column_name = 'last_health_check') THEN
    ALTER TABLE public.payment_integrations ADD COLUMN last_health_check timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_integrations' AND column_name = 'security_score') THEN
    ALTER TABLE public.payment_integrations ADD COLUMN security_score integer DEFAULT 0;
  END IF;
END $$;

-- 9. Create production deployment checklist table
CREATE TABLE IF NOT EXISTS public.production_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  item_description text,
  category text NOT NULL,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  priority_level text DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on production_checklist
ALTER TABLE public.production_checklist ENABLE ROW LEVEL SECURITY;

-- RLS policy for production_checklist
CREATE POLICY "Admins can manage production checklist" ON public.production_checklist
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 10. Insert initial production checklist items
INSERT INTO public.production_checklist (item_name, item_description, category, priority_level) VALUES
('Configure Live Paystack Keys', 'Set up live public key, secret key, and webhook secret', 'security', 'critical'),
('Update Webhook IP Whitelist', 'Ensure webhook endpoints validate Paystack IP addresses', 'security', 'critical'),
('Test Payment Flow End-to-End', 'Complete transaction from initiation to confirmation', 'testing', 'critical'),
('Configure Production Webhook URL', 'Set webhook URL to production domain', 'configuration', 'high'),
('Enable Production Monitoring', 'Set up alerts for payment failures and security incidents', 'monitoring', 'high'),
('Test Webhook Security', 'Verify signature validation and IP filtering', 'security', 'high'),
('Configure Error Handling', 'Ensure proper error logging and user feedback', 'reliability', 'medium'),
('Set Up Payment Reconciliation', 'Automated daily payment reconciliation process', 'operations', 'medium'),
('Document Incident Response', 'Create runbook for payment system incidents', 'operations', 'medium'),
('Performance Load Testing', 'Test system under expected production load', 'testing', 'medium')
ON CONFLICT DO NOTHING;