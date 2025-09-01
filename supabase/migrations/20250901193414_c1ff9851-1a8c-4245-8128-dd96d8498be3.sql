
-- Fix broken RPC: remove non-existent column and return safe, public config
DROP FUNCTION IF EXISTS public.get_public_paystack_config();

CREATE OR REPLACE FUNCTION public.get_public_paystack_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  cfg RECORD;
BEGIN
  -- Prefer a connected LIVE config first, else fall back to most recent record
  SELECT *
  INTO cfg
  FROM payment_integrations
  WHERE provider = 'paystack'
  ORDER BY 
    CASE 
      WHEN COALESCE(test_mode, true) = false 
           AND COALESCE(environment, 'live') = 'live' THEN 0 
      ELSE 1 
    END,
    CASE WHEN connection_status = 'connected' THEN 0 ELSE 1 END,
    updated_at DESC
  LIMIT 1;

  IF NOT FOUND OR cfg.public_key IS NULL THEN
    RETURN jsonb_build_object(
      'configured', false,
      'public_key', null,
      'test_mode', true,
      'environment', 'test'
    );
  END IF;

  RETURN jsonb_build_object(
    'configured', true,
    'public_key', cfg.public_key,
    'test_mode', COALESCE(cfg.test_mode, true),
    'environment', COALESCE(
      cfg.environment, 
      CASE WHEN COALESCE(cfg.test_mode, true) THEN 'test' ELSE 'live' END
    ),
    'connection_status', cfg.connection_status
  );
END;
$function$;

-- Restrict and grant execution
REVOKE ALL ON FUNCTION public.get_public_paystack_config() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_paystack_config() TO anon, authenticated;
