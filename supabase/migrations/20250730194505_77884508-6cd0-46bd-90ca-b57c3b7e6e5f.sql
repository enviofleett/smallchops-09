-- Fix function search path security issues by updating existing functions
-- Add SET search_path TO 'public' to existing functions

-- Update get_user_role function to fix search path
CREATE OR REPLACE FUNCTION public.get_user_role(user_id_to_check uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT role::TEXT FROM public.profiles WHERE id = user_id_to_check;
$function$;

-- Update is_admin function to fix search path  
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid();
$function$;

-- Update validate_admin_permission function to fix search path
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