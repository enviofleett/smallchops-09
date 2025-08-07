-- Apply search_path to ALL remaining functions in one batch
DO $$
DECLARE
    func_record RECORD;
    sql_cmd TEXT;
BEGIN
    -- Fix all functions in public schema that are security definers but don't have search_path set
    FOR func_record IN 
        SELECT 
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' 
          AND prosecdef = true
          AND NOT (p.prosrc LIKE '%SET search_path%' OR 'search_path' = ANY(string_to_array(p.proconfig::text, ',')))
    LOOP
        sql_cmd := format('ALTER FUNCTION %I(%s) SET search_path TO ''public''', 
                         func_record.function_name, 
                         func_record.args);
        
        EXECUTE sql_cmd;
    END LOOP;
END $$;