-- Fix remaining Security Definer Views and Functions
-- Query to find remaining security definer views
DO $$
DECLARE
    view_record RECORD;
BEGIN
    -- Drop any remaining security definer views
    FOR view_record IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname IN (
            SELECT viewname 
            FROM pg_views v
            JOIN pg_class c ON c.relname = v.viewname
            WHERE c.relkind = 'v'
            AND c.relrowsecurity = false  -- Security definer views
        )
    LOOP
        EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', view_record.schemaname, view_record.viewname);
    END LOOP;
END $$;

-- Fix functions with mutable search_path
-- Set search_path for all remaining functions that need it
ALTER FUNCTION public.gtrgm_in(cstring) SET search_path TO 'public';
ALTER FUNCTION public.gtrgm_out(gtrgm) SET search_path TO 'public';
ALTER FUNCTION public.gtrgm_consistent(internal, text, smallint, oid, internal) SET search_path TO 'public';
ALTER FUNCTION public.gtrgm_distance(internal, text, smallint, oid, internal) SET search_path TO 'public';
ALTER FUNCTION public.gtrgm_union(internal, internal) SET search_path TO 'public';
ALTER FUNCTION public.gtrgm_same(gtrgm, gtrgm, internal) SET search_path TO 'public';
ALTER FUNCTION public.gtrgm_penalty(internal, internal, internal) SET search_path TO 'public';
ALTER FUNCTION public.gtrgm_picksplit(internal, internal) SET search_path TO 'public';
ALTER FUNCTION public.gtrgm_compress(internal) SET search_path TO 'public';
ALTER FUNCTION public.gtrgm_decompress(internal) SET search_path TO 'public';
ALTER FUNCTION public.gtrgm_options(internal) SET search_path TO 'public';

-- Move extensions from public schema to extensions schema
-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pg_trgm extension to extensions schema (if possible)
-- Note: Some extensions may require superuser privileges to move
DO $$
BEGIN
    -- Try to move pg_trgm to extensions schema
    BEGIN
        ALTER EXTENSION pg_trgm SET SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
        -- Log that we couldn't move the extension
        INSERT INTO audit_logs (
            action, category, message, new_values
        ) VALUES (
            'extension_move_failed',
            'Security',
            'Could not move pg_trgm extension from public schema: ' || SQLERRM,
            jsonb_build_object(
                'extension', 'pg_trgm',
                'error', SQLERRM,
                'note', 'This may require superuser privileges'
            )
        );
    END;
END $$;

-- Create enhanced security check function
CREATE OR REPLACE FUNCTION public.check_security_compliance()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  security_definer_views INTEGER;
  mutable_search_path_functions INTEGER;
  extensions_in_public INTEGER;
  rls_disabled_tables INTEGER;
  compliance_score INTEGER := 100;
  issues TEXT[] := '{}';
  warnings TEXT[] := '{}';
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  -- Count Security Definer Views
  SELECT COUNT(*) INTO security_definer_views
  FROM pg_views v
  JOIN pg_class c ON c.relname = v.viewname
  WHERE v.schemaname = 'public'
  AND c.relkind = 'v';
  
  -- Count functions with mutable search_path
  SELECT COUNT(*) INTO mutable_search_path_functions
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND (p.proconfig IS NULL OR NOT ('search_path=public' = ANY(p.proconfig)));
  
  -- Count extensions in public schema
  SELECT COUNT(*) INTO extensions_in_public
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  WHERE n.nspname = 'public';
  
  -- Count tables without RLS
  SELECT COUNT(*) INTO rls_disabled_tables
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE t.schemaname = 'public'
  AND t.tablename IN ('customer_accounts', 'orders', 'payment_transactions', 'profiles')
  AND c.relrowsecurity = false;

  -- Calculate compliance score
  IF security_definer_views > 0 THEN
    compliance_score := compliance_score - (security_definer_views * 20);
    issues := array_append(issues, format('%s Security Definer views found', security_definer_views));
  END IF;
  
  IF mutable_search_path_functions > 0 THEN
    compliance_score := compliance_score - (mutable_search_path_functions * 5);
    warnings := array_append(warnings, format('%s functions with mutable search_path', mutable_search_path_functions));
  END IF;
  
  IF extensions_in_public > 0 THEN
    compliance_score := compliance_score - (extensions_in_public * 10);
    warnings := array_append(warnings, format('%s extensions in public schema', extensions_in_public));
  END IF;
  
  IF rls_disabled_tables > 0 THEN
    compliance_score := compliance_score - (rls_disabled_tables * 30);
    issues := array_append(issues, format('%s critical tables without RLS', rls_disabled_tables));
  END IF;

  RETURN jsonb_build_object(
    'compliant', compliance_score >= 80,
    'score', GREATEST(compliance_score, 0),
    'security_definer_views', security_definer_views,
    'mutable_search_path_functions', mutable_search_path_functions,
    'extensions_in_public', extensions_in_public,
    'rls_disabled_tables', rls_disabled_tables,
    'issues', issues,
    'warnings', warnings,
    'last_checked', NOW(),
    'status', CASE 
      WHEN compliance_score >= 90 THEN 'excellent'
      WHEN compliance_score >= 80 THEN 'good'
      WHEN compliance_score >= 60 THEN 'warning'
      ELSE 'critical'
    END
  );
END;
$function$;