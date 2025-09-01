-- Test the RPC function with proper service role access
SELECT public.get_public_paystack_config() as paystack_config;

-- Also verify the function exists and permissions
SELECT 
  p.proname as function_name,
  p.prosecdef as security_definer,
  array_to_string(p.proacl::text[], ', ') as permissions
FROM pg_proc p 
WHERE p.proname = 'get_public_paystack_config';