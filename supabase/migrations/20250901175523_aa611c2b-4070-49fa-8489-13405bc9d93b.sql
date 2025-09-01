-- Fix security issues from the production email migration

-- 1. Enable RLS on the new email system config summary view
-- Since it's a view, we need to secure it with appropriate policies
DROP VIEW IF EXISTS email_system_config_summary;

-- Create a secure function instead of a view for email system config
CREATE OR REPLACE FUNCTION get_email_system_config_summary()
RETURNS TABLE (
  id uuid,
  use_smtp boolean,
  smtp_host text,
  smtp_port integer,
  smtp_secure boolean,
  sender_email text,
  sender_name text,
  credential_source text,
  production_mode boolean,
  last_security_audit timestamp with time zone,
  security_status text,
  connection_security text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied - admin privileges required';
  END IF;

  RETURN QUERY
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
      WHEN cs.credential_source = 'function_secrets' THEN 'Production Secure'::text
      WHEN cs.smtp_pass IS NOT NULL AND LENGTH(cs.smtp_pass) > 20 THEN 'Database Stored'::text
      ELSE 'Needs Configuration'::text
    END as security_status,
    CASE 
      WHEN cs.smtp_port IN (587, 465) AND cs.smtp_secure THEN 'Secure'::text
      ELSE 'Needs SSL/TLS'::text
    END as connection_security,
    cs.created_at,
    cs.updated_at
  FROM communication_settings cs
  WHERE cs.use_smtp = true
  ORDER BY cs.created_at DESC;
END;
$$;

-- 2. Log completion of security fixes
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'email_security_fixes_completed',
  'System Security',
  'Fixed security issues from production email system migration',
  jsonb_build_object(
    'fixes_applied', jsonb_build_array(
      'Replaced view with secure function',
      'Added admin-only access control',
      'Set secure search_path'
    ),
    'timestamp', NOW()
  )
);