-- SECURITY FIX: Enable RLS on email_automation_config table
-- ========================================================

ALTER TABLE email_automation_config ENABLE ROW LEVEL SECURITY;

-- Create appropriate RLS policies for email_automation_config
CREATE POLICY "Admins can manage email automation config"
ON email_automation_config FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Service roles can read email automation config"
ON email_automation_config FOR SELECT
USING (auth.role() = 'service_role');

-- Set search path for the trigger function (addressing security warnings)
ALTER FUNCTION trigger_order_status_email() 
SET search_path = 'public', 'pg_catalog';

-- Log security fix
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'security_fixes_applied',
  'Security',
  'Applied RLS policies and search path fixes for Phase 1',
  jsonb_build_object(
    'rls_enabled_tables', ARRAY['email_automation_config'],
    'function_security_updated', true
  )
);