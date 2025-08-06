-- Fix function search_path security warnings
-- Only update functions that actually exist

-- Fix existing functions
ALTER FUNCTION get_active_paystack_config() SET search_path = '';
ALTER FUNCTION update_updated_at_column() SET search_path = '';

-- Create the missing function that was referenced
CREATE OR REPLACE FUNCTION public.get_active_paystack_config()
RETURNS TABLE(
  public_key text,
  test_mode boolean
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
    COALESCE(pi.test_mode, true) as test_mode
  FROM public.payment_integrations pi
  WHERE pi.provider = 'paystack' 
    AND pi.connection_status = 'connected'
  ORDER BY pi.updated_at DESC
  LIMIT 1;
END;
$$;