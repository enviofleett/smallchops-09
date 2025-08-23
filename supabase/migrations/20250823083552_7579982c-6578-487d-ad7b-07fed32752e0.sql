-- Enable RLS on critical tables that are missing it
DO $$
BEGIN
    -- Only enable RLS if not already enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'system_health_checks' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Add comprehensive security logging function if it doesn't exist
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_severity text DEFAULT 'medium',
  p_description text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO audit_logs (
    action,
    category, 
    message,
    user_id,
    new_values,
    event_time
  ) VALUES (
    p_event_type,
    'Security',
    p_description,
    auth.uid(),
    p_metadata || jsonb_build_object(
      'severity', p_severity,
      'timestamp', NOW(),
      'user_role', auth.role()
    ),
    NOW()
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Add missing policies only if they don't exist
DO $$
BEGIN
    -- System health checks policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'system_health_checks'
        AND policyname = 'Admin access system health'
    ) THEN
        CREATE POLICY "Admin access system health" ON system_health_checks
        FOR SELECT USING (is_admin());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'system_health_checks'
        AND policyname = 'Service roles manage system health'
    ) THEN
        CREATE POLICY "Service roles manage system health" ON system_health_checks
        FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;