-- Fix the get_active_paystack_config function to return the correct structure
DROP FUNCTION IF EXISTS public.get_active_paystack_config();

CREATE OR REPLACE FUNCTION public.get_active_paystack_config()
RETURNS TABLE(
  public_key text,
  test_mode boolean,
  secret_key text,
  webhook_secret text,
  environment text
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
    COALESCE(pi.test_mode, true) as test_mode,
    CASE 
      WHEN pi.test_mode THEN pi.secret_key 
      ELSE COALESCE(pi.live_secret_key, pi.secret_key)
    END as secret_key,
    pi.webhook_secret,
    CASE 
      WHEN pi.test_mode THEN 'test'::text 
      ELSE 'live'::text
    END as environment
  FROM public.payment_integrations pi
  WHERE pi.provider = 'paystack' 
    AND pi.connection_status = 'connected'
  ORDER BY pi.updated_at DESC
  LIMIT 1;
END;
$$;