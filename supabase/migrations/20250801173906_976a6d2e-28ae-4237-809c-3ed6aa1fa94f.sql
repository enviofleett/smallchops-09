-- Fix security issues from linter

-- Issue 1: Fix function search path for security
-- Update the check_paystack_production_readiness function to be more secure
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
  FROM public.payment_integrations 
  WHERE provider = 'paystack' 
  ORDER BY updated_at DESC 
  LIMIT 1;
  
  -- Get environment configuration
  SELECT * INTO v_env 
  FROM public.environment_config 
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
  FROM public.production_checklist
  WHERE priority_level IN ('critical', 'high');
  
  v_score := v_score + ROUND((v_checklist_completion / 100) * 25);
  
  -- Security checks (10 points)
  IF EXISTS (SELECT 1 FROM public.payment_integrations WHERE provider = 'paystack' AND connection_status = 'connected') THEN
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

-- Update other security definer functions to have explicit search path
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $function$
  SELECT role::text FROM public.profiles WHERE id = user_id;
$function$;