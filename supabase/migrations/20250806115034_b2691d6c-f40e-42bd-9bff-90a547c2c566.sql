-- Clean up conflicting create_order_with_items function versions
-- This migration drops the version with text delivery_zone_id parameter
-- to resolve function overloading conflicts

DO $$
DECLARE
    func_exists boolean;
BEGIN
    -- Check if the conflicting function exists (text version)
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'create_order_with_items'
        AND pg_get_function_arguments(p.oid) LIKE '%p_delivery_zone_id text%'
    ) INTO func_exists;
    
    -- Drop the conflicting version if it exists
    IF func_exists THEN
        DROP FUNCTION IF EXISTS public.create_order_with_items(
            p_customer_email text,
            p_customer_name text,
            p_items jsonb,
            p_customer_phone text,
            p_fulfillment_type text,
            p_delivery_address jsonb,
            p_guest_session_id text,
            p_payment_method text,
            p_delivery_zone_id text,
            p_delivery_fee numeric,
            p_total_amount numeric
        );
        
        RAISE NOTICE 'Dropped conflicting create_order_with_items function with text delivery_zone_id parameter';
        
        -- Log the cleanup operation
        INSERT INTO audit_logs (
            action,
            category,
            message,
            new_values
        ) VALUES (
            'function_cleanup',
            'Database Maintenance',
            'Dropped conflicting create_order_with_items function version',
            jsonb_build_object(
                'dropped_function', 'create_order_with_items(text delivery_zone_id)',
                'reason', 'Function overloading conflict resolution',
                'timestamp', NOW()
            )
        );
    ELSE
        RAISE NOTICE 'No conflicting create_order_with_items function found to drop';
    END IF;
    
    -- Verify the correct function still exists
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'create_order_with_items'
        AND pg_get_function_arguments(p.oid) LIKE '%p_delivery_zone_id uuid%'
    ) INTO func_exists;
    
    IF func_exists THEN
        RAISE NOTICE 'Confirmed: Correct create_order_with_items function with uuid delivery_zone_id exists';
    ELSE
        RAISE WARNING 'No create_order_with_items function with uuid delivery_zone_id found!';
    END IF;
END $$;