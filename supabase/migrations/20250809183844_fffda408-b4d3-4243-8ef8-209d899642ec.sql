-- 1) Safe public Paystack config RPC (returns only non-sensitive fields)
CREATE OR REPLACE FUNCTION public.get_public_paystack_config()
RETURNS TABLE(
  public_key text,
  test_mode boolean,
  environment text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public_key,
    COALESCE(test_mode, false) AS test_mode,
    CASE WHEN COALESCE(test_mode, false) THEN 'test' ELSE 'live' END AS environment
  FROM public.payment_integrations
  WHERE provider = 'paystack'
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1
$$;

-- Ensure only anon/authenticated can execute the public-safe RPC
REVOKE ALL ON FUNCTION public.get_public_paystack_config() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_paystack_config() TO anon, authenticated;

-- 2) Restrict sensitive get_active_paystack_config to service_role only (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_active_paystack_config' AND p.pronargs = 0
  ) THEN
    REVOKE ALL ON FUNCTION public.get_active_paystack_config() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.get_active_paystack_config() TO service_role;
    -- Harden search_path on the function
    ALTER FUNCTION public.get_active_paystack_config() SET search_path = public;
  END IF;
END $$;
