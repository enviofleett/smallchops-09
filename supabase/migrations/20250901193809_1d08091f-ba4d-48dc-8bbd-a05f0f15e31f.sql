-- Fix RPC permissions and check payment integrations
-- Re-grant proper permissions for RPC function
GRANT EXECUTE ON FUNCTION public.get_public_paystack_config() TO anon, authenticated, service_role;

-- Check current payment integrations structure and data
SELECT provider, public_key, test_mode, environment, connection_status, updated_at 
FROM payment_integrations 
WHERE provider = 'paystack' 
ORDER BY updated_at DESC;