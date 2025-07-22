
-- Fix database conflicts and optimize for production
-- Remove the problematic constraint and ensure menu_key is properly indexed
ALTER TABLE public.user_permissions DROP CONSTRAINT IF EXISTS check_menu_key_or_section;

-- Ensure menu_key is always populated for new permission system
UPDATE public.user_permissions 
SET menu_key = COALESCE(menu_key, menu_section::text || '_section') 
WHERE menu_key IS NULL;

-- Make menu_key required going forward
ALTER TABLE public.user_permissions ALTER COLUMN menu_key SET NOT NULL;

-- Add better indexing for performance
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_menu_key_fast ON public.user_permissions(user_id, menu_key, permission_level);
CREATE INDEX IF NOT EXISTS idx_profiles_role_fast ON public.profiles(id, role) WHERE role IN ('admin', 'manager');

-- Add rate limiting table for edge functions
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier text NOT NULL,
    action text NOT NULL,
    count integer DEFAULT 1,
    window_start timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(identifier, action, window_start)
);

-- Enable RLS on rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can manage rate limits
CREATE POLICY "Service role can manage rate limits" ON public.rate_limits
FOR ALL USING (auth.role() = 'service_role');

-- Add audit logging for admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
    action_type text,
    entity_type text,
    entity_id uuid,
    old_values jsonb DEFAULT NULL,
    new_values jsonb DEFAULT NULL,
    message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO public.audit_logs (
        user_id,
        action,
        category,
        entity_type,
        entity_id,
        message,
        old_values,
        new_values
    ) VALUES (
        auth.uid(),
        action_type,
        'Admin Management',
        entity_type,
        entity_id,
        COALESCE(message, action_type || ' performed on ' || entity_type),
        old_values,
        new_values
    );
END;
$$;
