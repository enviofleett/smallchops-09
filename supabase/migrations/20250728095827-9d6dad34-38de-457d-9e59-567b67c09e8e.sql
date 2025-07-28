-- Fix security warning: Set search_path for functions that don't have it set
-- Update functions to have proper search_path

CREATE OR REPLACE FUNCTION public.check_user_permission(user_id_param uuid, menu_key_param text, required_level_param text DEFAULT 'view'::text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.get_user_role(user_id_to_check uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT role::TEXT FROM public.profiles WHERE id = user_id_to_check;
$$;

CREATE OR REPLACE FUNCTION public.health_check()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'status', 'healthy',
    'timestamp', now(),
    'version', '1.0.0'
  );
$$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_count INTEGER;
  order_number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO order_count FROM public.orders;
  order_number := 'ORD' || LPAD(order_count::TEXT, 6, '0');
  RETURN order_number;
END;
$$;