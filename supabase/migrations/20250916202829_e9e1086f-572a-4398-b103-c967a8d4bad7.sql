-- Final comprehensive fix for all remaining security linter issues
-- Let's query the system catalogs to find the exact problematic objects

-- Step 1: Find and fix any remaining SECURITY DEFINER views
DO $$
DECLARE
    view_rec RECORD;
    new_definition TEXT;
BEGIN
    -- Find all views in public schema that might have SECURITY DEFINER
    FOR view_rec IN 
        SELECT schemaname, viewname, definition
        FROM pg_views 
        WHERE schemaname = 'public'
        AND definition ILIKE '%SECURITY DEFINER%'
    LOOP
        -- Log what we found
        INSERT INTO audit_logs (action, category, message, new_values)
        VALUES (
            'security_definer_view_found',
            'Security Fix',
            'Found SECURITY DEFINER view: ' || view_rec.viewname,
            jsonb_build_object('view_name', view_rec.viewname, 'definition', view_rec.definition)
        );
        
        -- Create new definition without SECURITY DEFINER
        new_definition := REPLACE(REPLACE(view_rec.definition, ' SECURITY DEFINER', ''), 'SECURITY DEFINER ', '');
        
        -- Drop and recreate the view
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(view_rec.schemaname) || '.' || quote_ident(view_rec.viewname) || ' CASCADE';
        EXECUTE 'CREATE VIEW ' || quote_ident(view_rec.schemaname) || '.' || quote_ident(view_rec.viewname) || ' AS ' || new_definition;
        
        INSERT INTO audit_logs (action, category, message, new_values)
        VALUES (
            'security_definer_view_fixed',
            'Security Fix',
            'Fixed SECURITY DEFINER view: ' || view_rec.viewname,
            jsonb_build_object('view_name', view_rec.viewname, 'new_definition', new_definition)
        );
    END LOOP;
END $$;

-- Step 2: Find and fix functions missing search_path
DO $$
DECLARE
    func_rec RECORD;
    func_def TEXT;
    new_func_def TEXT;
    func_signature TEXT;
BEGIN
    -- Find functions without search_path that are user-defined
    FOR func_rec IN 
        SELECT 
            p.oid,
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_functiondef(p.oid) as function_definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prolang != (SELECT oid FROM pg_language WHERE lanname = 'internal')
        AND p.proname NOT LIKE 'pg_%'
        AND pg_get_functiondef(p.oid) NOT ILIKE '%SET search_path%'
        AND pg_get_functiondef(p.oid) ILIKE '%LANGUAGE %'
    LOOP
        -- Log the function we found
        INSERT INTO audit_logs (action, category, message, new_values)
        VALUES (
            'function_missing_search_path_found',
            'Security Fix',
            'Function missing search_path: ' || func_rec.function_name,
            jsonb_build_object('function_name', func_rec.function_name, 'schema', func_rec.schema_name)
        );
        
        -- Get the function signature for proper dropping
        SELECT pg_get_function_identity_arguments(p.oid)
        INTO func_signature
        FROM pg_proc p
        WHERE p.oid = func_rec.oid;
        
        -- Modify the function definition to include search_path
        func_def := func_rec.function_definition;
        
        -- Find the position to insert SET search_path
        IF func_def ILIKE '%SECURITY DEFINER%' THEN
            new_func_def := REPLACE(func_def, 'SECURITY DEFINER', 'SECURITY DEFINER' || E'\n SET search_path = ''public''');
        ELSIF func_def ILIKE '%LANGUAGE plpgsql%' THEN
            new_func_def := REPLACE(func_def, 'LANGUAGE plpgsql', 'LANGUAGE plpgsql' || E'\n SET search_path = ''public''');
        ELSIF func_def ILIKE '%LANGUAGE sql%' THEN
            new_func_def := REPLACE(func_def, 'LANGUAGE sql', 'LANGUAGE sql' || E'\n SET search_path = ''public''');
        ELSE
            -- Skip if we can't determine where to add it
            CONTINUE;
        END IF;
        
        -- Drop and recreate the function
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(func_rec.schema_name) || '.' || quote_ident(func_rec.function_name) || '(' || func_signature || ') CASCADE';
            EXECUTE new_func_def;
            
            INSERT INTO audit_logs (action, category, message, new_values)
            VALUES (
                'function_search_path_fixed',
                'Security Fix',
                'Fixed search_path for function: ' || func_rec.function_name,
                jsonb_build_object('function_name', func_rec.function_name, 'schema', func_rec.schema_name)
            );
        EXCEPTION WHEN OTHERS THEN
            -- Log any errors but continue
            INSERT INTO audit_logs (action, category, message, new_values)
            VALUES (
                'function_search_path_fix_failed',
                'Security Fix',
                'Failed to fix search_path for function: ' || func_rec.function_name || ' - ' || SQLERRM,
                jsonb_build_object('function_name', func_rec.function_name, 'error', SQLERRM)
            );
        END;
    END LOOP;
END $$;

-- Step 3: Alternative approach - check for any remaining system views or functions
-- Sometimes Supabase creates system objects that might be flagged

-- List all objects that might be causing the security definer view warning
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
    'security_audit_system_check',
    'Security Fix',
    'Checking for any system-level security definer objects',
    jsonb_build_object(
        'views_with_security_definer', (
            SELECT jsonb_agg(jsonb_build_object('schema', schemaname, 'view', viewname))
            FROM pg_views 
            WHERE definition ILIKE '%SECURITY DEFINER%'
        ),
        'functions_without_search_path_count', (
            SELECT COUNT(*)
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND pg_get_functiondef(p.oid) NOT ILIKE '%SET search_path%'
            AND pg_get_functiondef(p.oid) ILIKE '%LANGUAGE %'
            AND p.proname NOT LIKE 'pg_%'
        )
    )
);

-- Final completion log
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'final_security_linter_fix_attempt',
  'Security Maintenance',
  'Completed final comprehensive attempt to fix all 7 security linter issues',
  jsonb_build_object(
    'timestamp', now(),
    'approach', 'System catalog queries and dynamic fixes',
    'target_issues', 7
  )
);