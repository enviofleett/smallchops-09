-- Fix security issue: Set search_path for functions that don't have it
ALTER FUNCTION public.generate_order_number() SET search_path = 'public';
ALTER FUNCTION public.queue_order_status_change_communication() SET search_path = 'public';

-- Create a production-ready health check function
CREATE OR REPLACE FUNCTION public.health_check()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT jsonb_build_object(
    'status', 'healthy',
    'timestamp', now(),
    'version', '1.0.0'
  );
$$;

-- Create function to check user permissions efficiently
CREATE OR REPLACE FUNCTION public.check_user_permission(user_id_param uuid, menu_key_param text, required_level_param text DEFAULT 'view')
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE 
    WHEN (SELECT role FROM public.profiles WHERE id = user_id_param) = 'admin' THEN true
    WHEN required_level_param = 'view' THEN 
      EXISTS (
        SELECT 1 FROM public.user_permissions 
        WHERE user_id = user_id_param 
        AND menu_key = menu_key_param 
        AND permission_level IN ('view', 'edit')
      )
    ELSE 
      EXISTS (
        SELECT 1 FROM public.user_permissions 
        WHERE user_id = user_id_param 
        AND menu_key = menu_key_param 
        AND permission_level = 'edit'
      )
  END;
$$;