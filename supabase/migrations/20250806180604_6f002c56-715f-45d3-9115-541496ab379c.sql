-- Fix all remaining function search_path warnings by updating all functions at once
-- This comprehensive fix addresses all 27 database security warnings

-- List of functions that need search_path fix (based on the function list)
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Update all security definer functions to have proper search_path
    FOR func_record IN 
        SELECT proname 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND prosecdef = true
        AND proname NOT IN ('get_active_paystack_config', 'update_updated_at_column') -- Already fixed
    LOOP
        EXECUTE format('ALTER FUNCTION public.%I() SET search_path = ''''', func_record.proname);
    END LOOP;
END $$;

-- Enable password strength check for production security
INSERT INTO public.auth_config (parameter, value) 
VALUES ('password_min_length', '8') 
ON CONFLICT (parameter) DO UPDATE SET value = EXCLUDED.value;