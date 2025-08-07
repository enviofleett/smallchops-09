-- Create the missing check_paystack_production_readiness function (without auth config changes)
CREATE OR REPLACE FUNCTION public.check_paystack_production_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_score INTEGER := 0;
  v_issues TEXT[] := '{}';
  v_warnings TEXT[] := '{}';
  v_config RECORD;
  v_webhook_url TEXT;
  v_live_keys_configured BOOLEAN := FALSE;
  v_webhook_configured BOOLEAN := FALSE;
  v_test_mode BOOLEAN := TRUE;
BEGIN
  -- Get current payment integration
  SELECT * INTO v_config 
  FROM payment_integrations 
  WHERE provider = 'paystack' 
  ORDER BY updated_at DESC 
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ready_for_production', false,
      'score', 0,
      'issues', ARRAY['No Paystack configuration found'],
      'warnings', ARRAY[]::TEXT[],
      'last_checked', NOW()
    );
  END IF;
  
  -- Check live keys configuration (30 points)
  IF v_config.live_public_key IS NOT NULL 
     AND v_config.live_secret_key IS NOT NULL 
     AND LENGTH(v_config.live_public_key) > 10
     AND LENGTH(v_config.live_secret_key) > 10
     AND v_config.live_public_key LIKE 'pk_live_%'
     AND v_config.live_secret_key LIKE 'sk_live_%' THEN
    v_score := v_score + 30;
    v_live_keys_configured := TRUE;
  ELSE
    v_issues := array_append(v_issues, 'Live API keys not properly configured');
  END IF;
  
  -- Check webhook configuration (25 points)
  IF v_config.webhook_secret IS NOT NULL AND LENGTH(v_config.webhook_secret) > 10 THEN
    v_score := v_score + 25;
    v_webhook_configured := TRUE;
  ELSE
    v_issues := array_append(v_issues, 'Webhook secret not configured');
  END IF;
  
  -- Check test mode status (15 points)
  IF NOT COALESCE(v_config.test_mode, TRUE) THEN
    v_score := v_score + 15;
    v_test_mode := FALSE;
  ELSE
    v_warnings := array_append(v_warnings, 'Currently in test mode - switch to live mode for production');
  END IF;
  
  -- Check webhook URL configuration (15 points)
  SELECT webhook_url INTO v_webhook_url 
  FROM production_config 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF v_webhook_url IS NOT NULL AND v_webhook_url LIKE '%paystack-webhook%' THEN
    v_score := v_score + 15;
  ELSE
    v_issues := array_append(v_issues, 'Production webhook URL not configured');
  END IF;
  
  -- Check connection status (15 points)
  IF v_config.connection_status = 'connected' THEN
    v_score := v_score + 15;
  ELSE
    v_issues := array_append(v_issues, 'Paystack connection not established');
  END IF;
  
  -- Determine overall readiness
  RETURN jsonb_build_object(
    'ready_for_production', (v_score >= 80 AND array_length(v_issues, 1) IS NULL),
    'score', v_score,
    'live_keys_configured', v_live_keys_configured,
    'webhook_configured', v_webhook_configured,
    'test_mode', v_test_mode,
    'issues', v_issues,
    'warnings', v_warnings,
    'last_checked', NOW()
  );
END;
$$;