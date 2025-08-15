-- PHASE 1: CRITICAL SECURITY FIXES (Check existing policies first)

-- 1. Secure Business Sensitive Data Table (if not already secured)
DO $$
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'business_sensitive_data' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE business_sensitive_data ENABLE ROW LEVEL SECURITY;
  END IF;
  
  -- Create admin access policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'business_sensitive_data' 
    AND policyname = 'Admins only access business data'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins only access business data" ON business_sensitive_data FOR ALL USING (is_admin())';
  END IF;
END $$;

-- 2. Secure Payment Integration Secrets (check existing policies)
DO $$
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'payment_integrations' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE payment_integrations ENABLE ROW LEVEL SECURITY;
  END IF;
  
  -- Create admin read policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payment_integrations' 
    AND policyname = 'Admins only payment secrets'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins only payment secrets" ON payment_integrations FOR SELECT USING (is_admin())';
  END IF;
  
  -- Create service role access policy if it doesn't exist  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payment_integrations' 
    AND policyname = 'Service role payment access'
  ) THEN
    EXECUTE 'CREATE POLICY "Service role payment access" ON payment_integrations FOR SELECT USING (auth.role() = ''service_role'')';
  END IF;
  
  -- Create admin management policy if it doesn't exist (skip if exists)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payment_integrations' 
    AND policyname = 'Admins can manage payment integrations'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can manage payment integrations" ON payment_integrations FOR ALL USING (is_admin()) WITH CHECK (is_admin())';
  END IF;
END $$;

-- 3. Secure Environment Configuration
DO $$
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'environment_config' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE environment_config ENABLE ROW LEVEL SECURITY;
  END IF;
  
  -- Create admin access policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'environment_config' 
    AND policyname = 'Admin only environment config'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin only environment config" ON environment_config FOR ALL USING (is_admin())';
  END IF;
END $$;

-- PHASE 2: DATABASE FUNCTION SECURITY HARDENING

-- Enhanced Security Monitoring and Audit Functions
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  table_name text,
  operation text,
  record_id uuid DEFAULT NULL,
  user_context jsonb DEFAULT '{}'
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
    new_values
  ) VALUES (
    'sensitive_data_access',
    'Security Monitoring',
    format('Sensitive data access: %s.%s', table_name, operation),
    auth.uid(),
    record_id,
    jsonb_build_object(
      'table', table_name,
      'operation', operation,
      'user_context', user_context,
      'timestamp', now()
    )
  );
END;
$$;

-- Comprehensive security incident logging
CREATE OR REPLACE FUNCTION public.log_security_violation(
  violation_type text,
  description text,
  severity text DEFAULT 'medium',
  metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  incident_id uuid;
BEGIN
  INSERT INTO security_incidents (
    type,
    description,
    severity,
    user_id,
    request_data,
    created_at
  ) VALUES (
    violation_type,
    description,
    severity,
    auth.uid(),
    metadata || jsonb_build_object(
      'function_context', 'log_security_violation',
      'timestamp', now()
    ),
    now()
  ) RETURNING id INTO incident_id;
  
  RETURN incident_id;
END;
$$;

-- Add triggers for sensitive data access monitoring (check if exists first)
CREATE OR REPLACE FUNCTION public.monitor_business_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM log_sensitive_data_access(
    'business_sensitive_data',
    TG_OP,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object('user_role', 'admin_required')
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'business_data_access_monitor'
  ) THEN
    EXECUTE 'CREATE TRIGGER business_data_access_monitor AFTER INSERT OR UPDATE OR DELETE ON business_sensitive_data FOR EACH ROW EXECUTE FUNCTION monitor_business_data_access()';
  END IF;
END $$;

-- Enhanced payment security monitoring
CREATE OR REPLACE FUNCTION public.monitor_payment_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log any access to payment integration secrets
  PERFORM log_sensitive_data_access(
    'payment_integrations',
    TG_OP,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'provider', COALESCE(NEW.provider, OLD.provider),
      'access_level', 'payment_secrets'
    )
  );
  
  -- Alert on any unauthorized access attempts
  IF NOT (is_admin() OR auth.role() = 'service_role') THEN
    PERFORM log_security_violation(
      'unauthorized_payment_access',
      'Unauthorized attempt to access payment integration secrets',
      'critical',
      jsonb_build_object(
        'user_id', auth.uid(),
        'operation', TG_OP,
        'table', 'payment_integrations'
      )
    );
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create payment access monitor trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'payment_access_monitor'
  ) THEN
    EXECUTE 'CREATE TRIGGER payment_access_monitor AFTER INSERT OR UPDATE OR DELETE ON payment_integrations FOR EACH ROW EXECUTE FUNCTION monitor_payment_access()';
  END IF;
END $$;