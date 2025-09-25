-- Phase 2C: Fix Remaining Function Search Path Issues (Production Security)

-- Fix function search paths for security (handle function overloads properly)
ALTER FUNCTION public.acquire_order_lock(uuid, text, integer) SET search_path = 'public';
ALTER FUNCTION public.acquire_order_lock(uuid, uuid, integer) SET search_path = 'public';

-- Fix additional functions that may not have search paths set
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Fix functions that don't have search_path set to 'public'
    FOR func_record IN 
        SELECT n.nspname as schema_name, p.proname as function_name, 
               pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname NOT LIKE 'pg_%'
        AND (p.proconfig IS NULL OR NOT ('search_path=public' = ANY(p.proconfig)))
        AND p.proname IN (
            'cache_idempotent_request_enhanced',
            'check_admin_rate_limit',
            'queue_communication_event_nonblocking',
            'log_customer_operation',
            'handle_successful_payment',
            'get_current_user_role',
            'is_admin'
        )
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = ''public''', 
                          func_record.function_name, func_record.args);
            RAISE NOTICE 'Fixed search_path for function: %', func_record.function_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not fix search_path for function: % - %', func_record.function_name, SQLERRM;
        END;
    END LOOP;
END
$$;

-- Create a production readiness check function
CREATE OR REPLACE FUNCTION public.check_production_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    result jsonb := '{"ready": true, "issues": []}'::jsonb;
    issue_count integer := 0;
BEGIN
    -- Check if sensitive tables have RLS enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND c.relname = 'payment_transactions'
        AND c.relrowsecurity = true
    ) THEN
        result := jsonb_set(result, '{issues}', 
            (result->'issues') || '["RLS not enabled on payment_transactions"]'::jsonb);
        result := jsonb_set(result, '{ready}', 'false'::jsonb);
        issue_count := issue_count + 1;
    END IF;

    -- Check if admin function exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'is_admin'
    ) THEN
        result := jsonb_set(result, '{issues}', 
            (result->'issues') || '["is_admin function missing"]'::jsonb);
        result := jsonb_set(result, '{ready}', 'false'::jsonb);
        issue_count := issue_count + 1;
    END IF;

    -- Add issue count
    result := jsonb_set(result, '{issue_count}', issue_count::text::jsonb);
    
    -- Add timestamp
    result := jsonb_set(result, '{checked_at}', to_jsonb(now()::text));
    
    RETURN result;
END;
$$;

-- Log this security improvement
INSERT INTO audit_logs (action, category, message, user_id, new_values)
VALUES (
  'production_security_functions_fixed',
  'Security',
  'Fixed function search paths and added production readiness check for Phase 2 completion',
  auth.uid(),
  jsonb_build_object(
    'functions_secured', 'multiple',
    'security_improvements', ARRAY['search_path_fixed', 'production_readiness_check_added'],
    'phase', 'phase_2_security_hardening'
  )
);