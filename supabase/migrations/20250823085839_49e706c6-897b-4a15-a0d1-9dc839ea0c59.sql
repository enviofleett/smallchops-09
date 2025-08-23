-- Clean up duplicate and ensure secure payment integrations policies
-- First, drop any potentially insecure policies
DROP POLICY IF EXISTS "Service role payment access" ON payment_integrations;
DROP POLICY IF EXISTS "Service roles can access payment integrations" ON payment_integrations;
DROP POLICY IF EXISTS "Admins only payment secrets" ON payment_integrations;
DROP POLICY IF EXISTS "Only admins can manage payment integrations" ON payment_integrations;

-- Create a single, comprehensive admin-only policy
CREATE POLICY "payment_integrations_admin_only"
ON payment_integrations
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Create a secure service role policy for edge functions only
CREATE POLICY "payment_integrations_service_role_only"
ON payment_integrations
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Add security logging for payment integration access
CREATE OR REPLACE FUNCTION public.log_payment_integration_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log all access to payment integrations table
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    old_values,
    new_values
  ) VALUES (
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'payment_integration_created'
      WHEN TG_OP = 'UPDATE' THEN 'payment_integration_updated'
      WHEN TG_OP = 'DELETE' THEN 'payment_integration_deleted'
      ELSE 'payment_integration_accessed'
    END,
    'Payment Security',
    'Payment integration ' || TG_OP || ' for provider: ' || COALESCE(NEW.provider, OLD.provider),
    auth.uid(),
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add trigger for audit logging
DROP TRIGGER IF EXISTS payment_integration_audit_trigger ON payment_integrations;
CREATE TRIGGER payment_integration_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_integrations
  FOR EACH ROW EXECUTE FUNCTION log_payment_integration_access();

-- Create a secure function to retrieve payment config for edge functions
CREATE OR REPLACE FUNCTION public.get_payment_config_secure(p_provider text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config jsonb;
  v_is_service_role boolean;
BEGIN
  -- Only allow service roles to access this function
  v_is_service_role := auth.role() = 'service_role';
  
  IF NOT v_is_service_role THEN
    -- Log unauthorized access attempt
    INSERT INTO audit_logs (
      action, category, message, user_id, new_values
    ) VALUES (
      'unauthorized_payment_config_access',
      'Security',
      'Unauthorized attempt to access payment config',
      auth.uid(),
      jsonb_build_object('provider', p_provider)
    );
    
    RAISE EXCEPTION 'Access denied: Only service roles can access payment configuration';
  END IF;
  
  -- Get payment configuration
  SELECT jsonb_build_object(
    'provider', provider,
    'public_key', CASE WHEN test_mode THEN public_key ELSE live_public_key END,
    'secret_key', CASE WHEN test_mode THEN secret_key ELSE live_secret_key END,
    'webhook_secret', CASE WHEN test_mode THEN webhook_secret ELSE live_webhook_secret END,
    'test_mode', test_mode,
    'currency', currency
  ) INTO v_config
  FROM payment_integrations
  WHERE provider = p_provider 
  AND connection_status = 'connected';
  
  -- Log access
  INSERT INTO audit_logs (
    action, category, message, new_values
  ) VALUES (
    'payment_config_accessed',
    'Payment Security',
    'Payment configuration accessed for provider: ' || p_provider,
    jsonb_build_object('provider', p_provider, 'config_found', v_config IS NOT NULL)
  );
  
  RETURN COALESCE(v_config, '{}'::jsonb);
END;
$$;