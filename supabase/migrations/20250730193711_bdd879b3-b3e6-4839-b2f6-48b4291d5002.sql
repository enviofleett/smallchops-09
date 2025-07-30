-- Fix function search path security issues
-- Update functions to have immutable search paths

-- Fix function: public.get_user_role
DROP FUNCTION IF EXISTS public.get_user_role(uuid);
CREATE OR REPLACE FUNCTION public.get_user_role(user_id_to_check uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT role::TEXT FROM public.profiles WHERE id = user_id_to_check;
$function$;

-- Fix function: public.is_admin
DROP FUNCTION IF EXISTS public.is_admin();
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid();
$function$;

-- Fix function: public.validate_admin_permission
DROP FUNCTION IF EXISTS public.validate_admin_permission(text);
CREATE OR REPLACE FUNCTION public.validate_admin_permission(required_permission text DEFAULT 'admin'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    user_role text;
BEGIN
    -- Get user role
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    -- Admin users have all permissions
    IF user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- For specific permission checks, check user_permissions table
    IF required_permission != 'admin' THEN
        RETURN EXISTS (
            SELECT 1 
            FROM public.user_permissions 
            WHERE user_id = auth.uid() 
            AND menu_key = required_permission 
            AND permission_level IN ('view', 'edit')
        );
    END IF;
    
    RETURN false;
END;
$function$;

-- Enable leaked password protection
-- This needs to be done via Supabase dashboard, but we'll document it
COMMENT ON SCHEMA public IS 'Enable leaked password protection in Supabase Auth settings';