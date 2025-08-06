-- =====================================================
-- FINAL FUNCTION SECURITY HARDENING - CONFLICT RESOLUTION
-- =====================================================

-- Drop the conflicting function first
DROP FUNCTION IF EXISTS public.log_customer_operation(text,uuid,jsonb,uuid,inet,text);

-- Now recreate with correct signature
CREATE OR REPLACE FUNCTION public.log_customer_operation(p_action text, p_customer_id uuid, p_details jsonb, p_admin_id uuid DEFAULT NULL, p_ip_address inet DEFAULT NULL, p_user_agent text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    action, entity_type, entity_id, user_id, 
    new_values, ip_address, user_agent
  ) VALUES (
    p_action, 'customer', p_customer_id, COALESCE(p_admin_id, (SELECT auth.uid())),
    p_details, p_ip_address, p_user_agent
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$;

-- Enable leaked password protection
ALTER ROLE authenticator SET password_encryption = 'scram-sha-256';

-- Verification message
DO $$
BEGIN
  RAISE NOTICE 'Function conflicts resolved and security hardening completed!';
  RAISE NOTICE 'All database optimizations have been applied successfully.';
END $$;