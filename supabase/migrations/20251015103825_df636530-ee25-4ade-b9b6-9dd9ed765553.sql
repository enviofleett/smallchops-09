-- Create admin IP tracking table
CREATE TABLE IF NOT EXISTS public.admin_ip_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  location_data JSONB,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_trusted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_ip_user ON admin_ip_history(user_id, ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_ip_last_seen ON admin_ip_history(last_seen_at);

-- Enable RLS
ALTER TABLE public.admin_ip_history ENABLE ROW LEVEL SECURITY;

-- Only admins can view IP history
CREATE POLICY "Admins can view IP history"
ON public.admin_ip_history
FOR SELECT
USING (is_admin());

-- Service role can manage IP tracking
CREATE POLICY "Service can manage IP history"
ON public.admin_ip_history
FOR ALL
USING (auth.role() = 'service_role');

-- Create security events categorization view
CREATE OR REPLACE VIEW security_events_categorized AS
SELECT 
  id,
  created_at,
  action,
  category,
  message,
  user_id,
  ip_address,
  CASE 
    -- CRITICAL: Real privilege escalation
    WHEN action = 'security_violation_detected' 
      AND message NOT LIKE '%system%'
      AND category = 'Security' THEN 'CRITICAL'
    
    -- CRITICAL: Multiple failed logins
    WHEN action LIKE '%login_failed%' THEN 'CRITICAL'
    
    -- WARNING: Unauthorized order access (except system operations)
    WHEN action = 'unauthorized_order_access_attempt'
      AND user_id IS NOT NULL THEN 'WARNING'
    
    -- INFO: Payment tracking (normal)
    WHEN action LIKE '%payment_transaction%' 
      AND message LIKE '%accessed%' THEN 'INFO'
    
    -- INFO: Email processing (normal)
    WHEN action LIKE '%email%' THEN 'INFO'
    
    -- WARNING: Everything else suspicious
    WHEN category IN ('Security', 'Security Violation') THEN 'WARNING'
    
    ELSE 'INFO'
  END as threat_level,
  
  CASE
    WHEN action = 'security_violation_detected' THEN 'Privilege Escalation'
    WHEN action LIKE '%login_failed%' THEN 'Failed Authentication'
    WHEN action = 'unauthorized_order_access_attempt' THEN 'Unauthorized Access'
    WHEN action LIKE '%payment%' THEN 'Payment Security'
    ELSE 'General Security'
  END as event_category

FROM audit_logs
WHERE category IN ('Security', 'Security Violation', 'Payment Security')
  OR action LIKE '%security%'
  OR action LIKE '%unauthorized%'
ORDER BY created_at DESC;

-- Insert pre-configured alert rules
INSERT INTO alert_rules (
  rule_name,
  condition_sql,
  threshold_value,
  check_interval_seconds,
  severity,
  is_active
) VALUES 
(
  'Multiple Failed Logins',
  'SELECT COUNT(*) FROM audit_logs WHERE action LIKE ''%login_failed%'' AND created_at > NOW() - INTERVAL ''5 minutes'' GROUP BY ip_address HAVING COUNT(*) >= $1',
  3,
  300,
  'critical',
  true
),
(
  'Privilege Escalation Attempt',
  'SELECT COUNT(*) FROM audit_logs WHERE category = ''Security'' AND action = ''security_violation_detected'' AND message NOT LIKE ''%system%'' AND created_at > NOW() - INTERVAL ''15 minutes''',
  1,
  300,
  'critical',
  true
),
(
  'Unusual Data Access Pattern',
  'SELECT COUNT(DISTINCT entity_id) FROM audit_logs WHERE action = ''SELECT'' AND user_id IS NOT NULL AND created_at > NOW() - INTERVAL ''5 minutes'' GROUP BY user_id HAVING COUNT(DISTINCT entity_id) >= $1',
  100,
  300,
  'warning',
  true
),
(
  'High Payment Failure Rate',
  'SELECT COUNT(*) FROM audit_logs WHERE category = ''Payment Security'' AND message LIKE ''%failed%'' AND created_at > NOW() - INTERVAL ''30 minutes''',
  5,
  600,
  'warning',
  true
)
ON CONFLICT DO NOTHING;