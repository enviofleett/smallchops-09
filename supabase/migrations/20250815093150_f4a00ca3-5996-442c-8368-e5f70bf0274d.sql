-- Drop and recreate functions with parameter conflicts
DROP FUNCTION IF EXISTS public.log_customer_operation(text,uuid,jsonb,uuid,inet,text);

-- Recreate with correct signature and search_path
CREATE OR REPLACE FUNCTION public.log_customer_operation(
  p_operation text,
  p_customer_id uuid,
  p_changes jsonb DEFAULT '{}',
  p_admin_id uuid DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    'customer_' || p_operation,
    'Customer Management',
    'Customer operation: ' || p_operation,
    COALESCE(p_admin_id, auth.uid()),
    p_customer_id,
    p_changes,
    p_ip_address::text,
    p_user_agent
  );
END;
$$;

-- Update remaining functions with search_path
CREATE OR REPLACE FUNCTION public.validate_admin_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin' 
    AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.jwt() ->> 'email';
$$;

CREATE OR REPLACE FUNCTION public.get_current_logo()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT logo_url FROM logo_versions WHERE is_current = true LIMIT 1;
$$;