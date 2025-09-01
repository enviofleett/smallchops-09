-- Fix the get_public_paystack_config RPC to read from payment_integrations table
CREATE OR REPLACE FUNCTION public.get_public_paystack_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_data RECORD;
BEGIN
  -- Get Paystack configuration from payment_integrations table
  SELECT * INTO config_data
  FROM payment_integrations
  WHERE provider = 'paystack'
  AND is_active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'public_key', null,
      'test_mode', true,
      'environment', 'test',
      'configured', false
    );
  END IF;
  
  -- Return only public configuration data
  RETURN jsonb_build_object(
    'public_key', config_data.public_key,
    'test_mode', COALESCE(config_data.test_mode, true),
    'environment', CASE 
      WHEN COALESCE(config_data.test_mode, true) THEN 'test' 
      ELSE 'live' 
    END,
    'configured', true,
    'webhook_url', config_data.webhook_url
  );
END;
$$;