-- CRITICAL SECURITY FIXES - Careful Policy Updates

-- 1. Drop and recreate overly permissive business_settings policies
DROP POLICY IF EXISTS "business_settings_read_policy" ON public.business_settings;
DROP POLICY IF EXISTS "business_settings_admin_policy" ON public.business_settings;
DROP POLICY IF EXISTS "Public read limited business info" ON public.business_settings;
DROP POLICY IF EXISTS "Admins manage business settings" ON public.business_settings;

-- Create secure business_settings policies
CREATE POLICY "Secure public read business info"
ON public.business_settings
FOR SELECT
TO public
USING (true);

CREATE POLICY "Secure admins manage business settings"
ON public.business_settings
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 2. Check if delivery zones policies exist and drop them carefully
DO $$
BEGIN
    BEGIN
        DROP POLICY IF EXISTS "Public can view delivery zones" ON public.delivery_zones;
    EXCEPTION
        WHEN undefined_object THEN
            -- Policy doesn't exist, continue
            NULL;
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "Authenticated users can view delivery zones" ON public.delivery_zones;
    EXCEPTION
        WHEN undefined_object THEN
            NULL;
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "Admins can manage delivery zones" ON public.delivery_zones;
    EXCEPTION
        WHEN undefined_object THEN
            NULL;
    END;
END
$$;

-- Create secure delivery zones policies
CREATE POLICY "Secure authenticated users view delivery zones"
ON public.delivery_zones
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Secure admins manage delivery zones"
ON public.delivery_zones
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 3. Secure delivery fees policies
DO $$
BEGIN
    BEGIN
        DROP POLICY IF EXISTS "Public can view delivery fees" ON public.delivery_fees;
    EXCEPTION
        WHEN undefined_object THEN
            NULL;
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "Authenticated users can view delivery fees" ON public.delivery_fees;
    EXCEPTION
        WHEN undefined_object THEN
            NULL;
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "Admins can manage delivery fees" ON public.delivery_fees;
    EXCEPTION
        WHEN undefined_object THEN
            NULL;
    END;
END
$$;

CREATE POLICY "Secure authenticated users view delivery fees"
ON public.delivery_fees
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Secure admins manage delivery fees"
ON public.delivery_fees
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 4. Create security rate limiting table if not exists
CREATE TABLE IF NOT EXISTS public.security_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  operation_type TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on security_rate_limits if not already enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'security_rate_limits'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- Create policies for security_rate_limits
DO $$
BEGIN
    BEGIN
        CREATE POLICY "Secure users view own rate limits"
        ON public.security_rate_limits
        FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());
    EXCEPTION
        WHEN duplicate_object THEN
            NULL;
    END;
    
    BEGIN
        CREATE POLICY "Secure service roles manage rate limits"
        ON public.security_rate_limits
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    EXCEPTION
        WHEN duplicate_object THEN
            NULL;
    END;
END
$$;