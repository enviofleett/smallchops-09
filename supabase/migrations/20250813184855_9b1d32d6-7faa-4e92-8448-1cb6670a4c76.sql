-- Fix security issue: Restrict access to environment_config table to admin users only

-- Check if environment_config table exists and create RLS policies
DO $$
BEGIN
    -- Enable RLS on environment_config table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'environment_config') THEN
        -- Enable Row Level Security
        ALTER TABLE public.environment_config ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Only admins can access environment config" ON public.environment_config;
        DROP POLICY IF EXISTS "Only admins can manage environment config" ON public.environment_config;
        
        -- Create restrictive RLS policy for environment_config
        CREATE POLICY "Only admins can access environment config"
        ON public.environment_config
        FOR ALL
        USING (is_admin())
        WITH CHECK (is_admin());
        
        RAISE NOTICE 'RLS policies applied to environment_config table';
    ELSE
        RAISE NOTICE 'environment_config table does not exist - no action needed';
    END IF;
END $$;