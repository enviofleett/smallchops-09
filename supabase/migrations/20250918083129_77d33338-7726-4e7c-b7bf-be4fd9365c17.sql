-- Fix security warnings - ensure all functions have proper search_path

-- Fix function search paths for existing functions
ALTER FUNCTION public.check_production_payment_safety() SET search_path = 'public';
ALTER FUNCTION public.log_payment_security_event(text, jsonb, text) SET search_path = 'public';
ALTER FUNCTION public.upsert_communication_event(text, text, text, text, jsonb, uuid, text) SET search_path = 'public';
ALTER FUNCTION public.check_payment_rate_limit(uuid, text) SET search_path = 'public';
ALTER FUNCTION public.upsert_communication_event_production(text, text, text, jsonb, uuid, text) SET search_path = 'public';
ALTER FUNCTION public.verify_and_update_payment_status(text, text, numeric, jsonb) SET search_path = 'public';
ALTER FUNCTION public.process_payment_atomically(text, text, integer, jsonb, text) SET search_path = 'public';
ALTER FUNCTION public.update_order_status(uuid, text, text, jsonb) SET search_path = 'public';
ALTER FUNCTION public.run_security_audit() SET search_path = 'public';
ALTER FUNCTION public.update_order_status_safe(text, text, integer, text) SET search_path = 'public';
ALTER FUNCTION public.cleanup_old_audit_logs() SET search_path = 'public';
ALTER FUNCTION public.get_security_events(integer, text) SET search_path = 'public';
ALTER FUNCTION public.admin_update_order_status_secure(uuid, text, uuid) SET search_path = 'public';
ALTER FUNCTION public.log_admin_action(text, uuid, jsonb) SET search_path = 'public';
ALTER FUNCTION public.admin_queue_order_email(uuid, text) SET search_path = 'public';
ALTER FUNCTION public.calculate_daily_delivery_analytics(date) SET search_path = 'public';
ALTER FUNCTION public.admin_safe_update_order_status(uuid, text, uuid) SET search_path = 'public';
ALTER FUNCTION public.safe_update_order_status(uuid, text, uuid) SET search_path = 'public';
ALTER FUNCTION public.process_queued_communication_events() SET search_path = 'public';

-- Add function to check and fix any remaining search path issues
CREATE OR REPLACE FUNCTION public.audit_function_security() 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    result jsonb := '{"functions_checked": 0, "functions_fixed": 0, "issues": []}'::jsonb;
    rec record;
    fix_count integer := 0;
BEGIN
    -- Check all user-defined functions for security issues
    FOR rec IN 
        SELECT 
            n.nspname as schema_name,
            p.proname as function_name,
            p.prosecdef as is_security_definer,
            array_to_string(p.proconfig, ' ') as config
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname NOT LIKE 'pg_%'
        AND p.proname NOT LIKE 'information_schema_%'
    LOOP
        result := jsonb_set(result, '{functions_checked}', 
            (result->>'functions_checked')::integer + 1);
            
        -- Check if function has search_path set
        IF rec.config IS NULL OR rec.config NOT LIKE '%search_path%' THEN
            result := jsonb_set(result, '{issues}', 
                (result->'issues') || jsonb_build_array(
                    jsonb_build_object(
                        'function', rec.schema_name || '.' || rec.function_name,
                        'issue', 'Missing search_path configuration',
                        'security_definer', rec.is_security_definer
                    )
                )
            );
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$;