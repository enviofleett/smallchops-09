-- Fix remaining search_path warnings by targeting specific functions
-- Skip functions that take parameters as they may have overloads

-- Fix functions without parameters first
ALTER FUNCTION public.bulk_safe_delete_products() SET search_path = '';
ALTER FUNCTION public.calculate_brand_consistency_score() SET search_path = '';
ALTER FUNCTION public.check_admin_creation_rate_limit() SET search_path = '';
ALTER FUNCTION public.check_paystack_production_readiness() SET search_path = '';
ALTER FUNCTION public.cleanup_expired_admin_invitations() SET search_path = '';
ALTER FUNCTION public.cleanup_expired_rate_limits() SET search_path = '';
ALTER FUNCTION public.cleanup_old_communication_events() SET search_path = '';
ALTER FUNCTION public.is_admin() SET search_path = '';