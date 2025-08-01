-- Add support for live API keys in payment_integrations table
ALTER TABLE public.payment_integrations 
ADD COLUMN IF NOT EXISTS live_public_key TEXT,
ADD COLUMN IF NOT EXISTS live_secret_key TEXT,
ADD COLUMN IF NOT EXISTS live_webhook_secret TEXT;

-- Update production checklist with specific items for live deployment
INSERT INTO public.production_checklist (item_name, item_description, category, priority_level, is_completed)
VALUES 
  ('Configure Live API Keys', 'Set up live Paystack public, secret, and webhook keys in the Live Keys tab', 'configuration', 'critical', false),
  ('Test Live Payment Flow', 'Run end-to-end payment testing with live keys to ensure functionality', 'testing', 'critical', false),
  ('Verify Webhook Security', 'Confirm webhook IP validation and signature verification are working', 'security', 'high', false),
  ('Set Production Webhook URL', 'Configure production webhook URL in Paystack dashboard', 'configuration', 'high', false),
  ('Enable Live Mode', 'Switch environment to live mode for real transactions', 'operations', 'critical', false),
  ('Monitor Payment Metrics', 'Set up monitoring for payment success rates and error tracking', 'monitoring', 'medium', false),
  ('Test Payment Methods', 'Verify all payment methods (card, bank transfer, USSD) work in production', 'testing', 'high', false),
  ('Backup and Recovery Plan', 'Ensure data backup and recovery procedures are in place', 'reliability', 'medium', false)
ON CONFLICT (item_name) DO UPDATE SET
  item_description = EXCLUDED.item_description,
  category = EXCLUDED.category,
  priority_level = EXCLUDED.priority_level;

-- Create function to check Paystack production readiness
CREATE OR REPLACE FUNCTION public.check_paystack_production_readiness()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_score INTEGER := 0;
  v_issues TEXT[] := '{}';
  v_warnings TEXT[] := '{}';
  v_config RECORD;
  v_env RECORD;
  v_checklist_completion NUMERIC;
BEGIN
  -- Get current payment integration
  SELECT * INTO v_config 
  FROM payment_integrations 
  WHERE provider = 'paystack' 
  ORDER BY updated_at DESC 
  LIMIT 1;
  
  -- Get environment configuration
  SELECT * INTO v_env 
  FROM environment_config 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- Check live keys configuration (25 points)
  IF v_config.live_public_key IS NOT NULL AND v_config.live_secret_key IS NOT NULL AND v_config.live_webhook_secret IS NOT NULL THEN
    v_score := v_score + 25;
  ELSE
    v_issues := array_append(v_issues, 'Live API keys not configured');
  END IF;
  
  -- Check webhook secret is not empty (15 points)
  IF v_config.webhook_secret IS NOT NULL AND length(v_config.webhook_secret) > 0 THEN
    v_score := v_score + 15;
  ELSE
    v_issues := array_append(v_issues, 'Webhook secret is empty or not configured');
  END IF;
  
  -- Check environment configuration (15 points)
  IF v_env.webhook_url IS NOT NULL AND v_env.webhook_url LIKE '%paystack-webhook-secure%' THEN
    v_score := v_score + 15;
  ELSE
    v_warnings := array_append(v_warnings, 'Production webhook URL not configured');
  END IF;
  
  -- Check test keys are different from live keys (10 points)
  IF v_config.public_key != v_config.live_public_key AND v_config.secret_key != v_config.live_secret_key THEN
    v_score := v_score + 10;
  ELSE
    v_warnings := array_append(v_warnings, 'Test and live keys appear to be the same');
  END IF;
  
  -- Check production checklist completion (25 points)
  SELECT 
    ROUND((COUNT(*) FILTER (WHERE is_completed = true)::NUMERIC / COUNT(*)) * 100, 1)
  INTO v_checklist_completion
  FROM production_checklist
  WHERE priority_level IN ('critical', 'high');
  
  v_score := v_score + ROUND((v_checklist_completion / 100) * 25);
  
  -- Security checks (10 points)
  IF EXISTS (SELECT 1 FROM payment_integrations WHERE provider = 'paystack' AND connection_status = 'connected') THEN
    v_score := v_score + 10;
  ELSE
    v_warnings := array_append(v_warnings, 'Payment connection not tested');
  END IF;
  
  -- Final validation
  IF array_length(v_issues, 1) > 0 THEN
    v_score := LEAST(v_score, 75); -- Cap score if there are critical issues
  END IF;
  
  RETURN jsonb_build_object(
    'ready_for_production', (v_score >= 85 AND array_length(v_issues, 1) = 0),
    'score', v_score,
    'issues', v_issues,
    'warnings', v_warnings,
    'last_checked', now(),
    'environment', COALESCE(v_env.environment, 'development'),
    'live_mode', COALESCE(v_env.is_live_mode, false),
    'checklist_completion', v_checklist_completion
  );
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.check_paystack_production_readiness() TO authenticated;

-- Add audit logging for production changes
INSERT INTO public.audit_logs (action, category, message, new_values)
VALUES (
  'production_checklist_created',
  'System Configuration',
  'Production checklist items created for Paystack deployment',
  jsonb_build_object(
    'items_added', 8,
    'critical_items', 4,
    'high_priority_items', 3
  )
);