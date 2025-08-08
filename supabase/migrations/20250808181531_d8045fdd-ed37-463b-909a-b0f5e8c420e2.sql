
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
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN pi.test_mode THEN pi.public_key 
      ELSE COALESCE(pi.live_public_key, pi.public_key)
    END AS public_key,
    COALESCE(pi.test_mode, true) AS test_mode,
    CASE 
      WHEN pi.test_mode THEN pi.secret_key 
      ELSE COALESCE(pi.live_secret_key, pi.secret_key)
    END AS secret_key,
    /* Ensure webhook_secret is never null: default to the effective secret key */
    COALESCE(
      pi.webhook_secret,
      CASE 
        WHEN pi.test_mode THEN pi.secret_key
        ELSE COALESCE(pi.live_secret_key, pi.secret_key)
      END
    ) AS webhook_secret,
    CASE 
      WHEN pi.test_mode THEN 'test'::text 
      ELSE 'live'::text
    END AS environment
  FROM public.payment_integrations pi
  WHERE pi.provider = 'paystack' 
    AND pi.connection_status = 'connected'
  ORDER BY pi.updated_at DESC
  LIMIT 1;
END;
$function$;
