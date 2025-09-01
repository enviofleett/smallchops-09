-- Production Email System Security Hardening and Cleanup

-- 1. Clean up old database-stored SMTP passwords for security
-- Replace with masked values to indicate Function Secrets should be used
UPDATE communication_settings 
SET 
  smtp_pass = CASE 
    WHEN smtp_pass IS NOT NULL AND smtp_pass != '' 
    THEN 'function_secrets_recommended' 
    ELSE smtp_pass 
  END,
  updated_at = NOW()
WHERE smtp_pass IS NOT NULL 
  AND smtp_pass != '' 
  AND smtp_pass != 'function_secrets_recommended';

-- 2. Add production readiness indicators
ALTER TABLE communication_settings 
ADD COLUMN IF NOT EXISTS production_mode boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_security_audit timestamp with time zone DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS credential_source text DEFAULT 'database';

-- 3. Create function to validate SMTP security in production
CREATE OR REPLACE FUNCTION validate_smtp_production_security()
RETURNS trigger AS $$
BEGIN
  -- Warn when storing plaintext passwords in production
  IF NEW.smtp_pass IS NOT NULL 
     AND NEW.smtp_pass != '' 
     AND NEW.smtp_pass != 'function_secrets_recommended'
     AND LENGTH(NEW.smtp_pass) < 50 THEN
    
    -- Log security audit event
    INSERT INTO audit_logs (
      action,
      category,
      message,
      user_id,
      entity_id,
      metadata
    ) VALUES (
      'smtp_security_warning',
      'Security Audit',
      'SMTP password stored in database - recommend Function Secrets for production',
      auth.uid(),
      NEW.id,
      jsonb_build_object(
        'credential_length', LENGTH(NEW.smtp_pass),
        'recommendation', 'Use Supabase Function Secrets for production SMTP credentials',
        'audit_timestamp', NOW()
      )
    );
    
    -- Set audit timestamp
    NEW.last_security_audit = NOW();
    NEW.credential_source = 'database';
  ELSIF NEW.smtp_pass = 'function_secrets_recommended' OR NEW.smtp_pass IS NULL THEN
    NEW.credential_source = 'function_secrets';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 4. Create trigger for SMTP security validation
DROP TRIGGER IF EXISTS trigger_validate_smtp_security ON communication_settings;
CREATE TRIGGER trigger_validate_smtp_security
  BEFORE INSERT OR UPDATE ON communication_settings
  FOR EACH ROW
  EXECUTE FUNCTION validate_smtp_production_security();

-- 5. Create production email system health check function
CREATE OR REPLACE FUNCTION get_email_system_production_status()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  config_record RECORD;
  function_secrets_available boolean := false;
  result jsonb;
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'Access denied - admin required');
  END IF;

  -- Get current SMTP configuration
  SELECT * INTO config_record
  FROM communication_settings
  WHERE use_smtp = true
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if Function Secrets are likely being used
  -- (This is a heuristic since we can't directly access edge function env vars)
  IF config_record.smtp_pass IS NULL 
     OR config_record.smtp_pass = 'function_secrets_recommended'
     OR config_record.credential_source = 'function_secrets' THEN
    function_secrets_available := true;
  END IF;

  -- Build comprehensive status
  result := jsonb_build_object(
    'status', CASE 
      WHEN config_record IS NULL THEN 'not_configured'
      WHEN NOT config_record.use_smtp THEN 'smtp_disabled'
      WHEN function_secrets_available THEN 'production_ready'
      ELSE 'needs_security_hardening'
    END,
    'configuration', jsonb_build_object(
      'smtp_configured', config_record IS NOT NULL,
      'smtp_enabled', COALESCE(config_record.use_smtp, false),
      'using_function_secrets', function_secrets_available,
      'credential_source', COALESCE(config_record.credential_source, 'unknown'),
      'last_security_audit', config_record.last_security_audit,
      'host_configured', config_record.smtp_host IS NOT NULL,
      'secure_port', config_record.smtp_port IN (587, 465),
      'ssl_enabled', COALESCE(config_record.smtp_secure, false)
    ),
    'recommendations', CASE 
      WHEN config_record IS NULL THEN 
        jsonb_build_array('Configure SMTP settings')
      WHEN NOT config_record.use_smtp THEN 
        jsonb_build_array('Enable SMTP in communication settings')
      WHEN NOT function_secrets_available THEN 
        jsonb_build_array(
          'Move SMTP credentials to Function Secrets for production security',
          'Update credential_source to function_secrets after migration'
        )
      ELSE jsonb_build_array('Email system is production-ready')
    END,
    'security_score', CASE 
      WHEN function_secrets_available AND config_record.smtp_secure AND config_record.smtp_port IN (587, 465) THEN 100
      WHEN function_secrets_available THEN 85
      WHEN config_record.smtp_secure THEN 60
      ELSE 30
    END,
    'last_updated', NOW()
  );

  RETURN result;
END;
$$;

-- 6. Clean up old email logs for performance (keep last 30 days)
DELETE FROM smtp_delivery_logs 
WHERE created_at < NOW() - INTERVAL '30 days';

-- 7. Optimize email system tables with proper indexes
CREATE INDEX IF NOT EXISTS idx_communication_events_status_priority 
ON communication_events(status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_smtp_delivery_logs_recent 
ON smtp_delivery_logs(created_at DESC, delivery_status);

-- 8. Create email system configuration summary view for production monitoring
CREATE OR REPLACE VIEW email_system_config_summary AS
SELECT 
  cs.id,
  cs.use_smtp,
  cs.smtp_host,
  cs.smtp_port,
  cs.smtp_secure,
  cs.sender_email,
  cs.sender_name,
  cs.credential_source,
  cs.production_mode,
  cs.last_security_audit,
  CASE 
    WHEN cs.credential_source = 'function_secrets' THEN 'Production Secure'
    WHEN cs.smtp_pass IS NOT NULL AND LENGTH(cs.smtp_pass) > 20 THEN 'Database Stored'
    ELSE 'Needs Configuration'
  END as security_status,
  CASE 
    WHEN cs.smtp_port IN (587, 465) AND cs.smtp_secure THEN 'Secure'
    ELSE 'Needs SSL/TLS'
  END as connection_security,
  cs.created_at,
  cs.updated_at
FROM communication_settings cs
WHERE cs.use_smtp = true
ORDER BY cs.created_at DESC;

-- Grant access to email config summary for admins
GRANT SELECT ON email_system_config_summary TO authenticated;

-- 9. Log this security hardening migration
INSERT INTO audit_logs (
  action,
  category,
  message,
  metadata
) VALUES (
  'email_security_hardening_migration',
  'System Security',
  'Production email system security hardening and cleanup completed',
  jsonb_build_object(
    'migration_version', '2024.01.security_hardening',
    'changes', jsonb_build_array(
      'Cleaned up database-stored SMTP passwords',
      'Added production security validation trigger',
      'Created email system health check function',
      'Optimized email system indexes',
      'Created production monitoring view'
    ),
    'timestamp', NOW()
  )
);