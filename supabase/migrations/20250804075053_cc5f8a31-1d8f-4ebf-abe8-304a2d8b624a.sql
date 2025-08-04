-- Create SMTP provider configurations table for multi-provider fallback
CREATE TABLE IF NOT EXISTS smtp_provider_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  secure BOOLEAN NOT NULL DEFAULT false,
  auth_user TEXT NOT NULL,
  auth_pass TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  health_score INTEGER NOT NULL DEFAULT 100,
  priority INTEGER NOT NULL DEFAULT 1,
  last_success_at TIMESTAMP WITH TIME ZONE,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create SMTP connection audit table for monitoring (without foreign key initially)
CREATE TABLE IF NOT EXISTS smtp_connection_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID,
  attempt_type TEXT NOT NULL, -- 'send_email', 'test_connection', 'recovery_test'
  success BOOLEAN NOT NULL DEFAULT false,
  recipient_email TEXT,
  response_message TEXT,
  error_message TEXT,
  connection_time_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email health snapshots table for trending
CREATE TABLE IF NOT EXISTS email_health_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timeframe_hours INTEGER NOT NULL,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_delivered INTEGER NOT NULL DEFAULT 0,
  total_failed INTEGER NOT NULL DEFAULT 0,
  delivery_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  failure_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  healthy_providers INTEGER NOT NULL DEFAULT 0,
  alerts JSONB DEFAULT '[]',
  provider_details JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Now add the foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'smtp_connection_audit_provider_id_fkey'
  ) THEN
    ALTER TABLE smtp_connection_audit 
    ADD CONSTRAINT smtp_connection_audit_provider_id_fkey 
    FOREIGN KEY (provider_id) REFERENCES smtp_provider_configs(id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_smtp_provider_configs_active_health ON smtp_provider_configs(is_active, health_score DESC);
CREATE INDEX IF NOT EXISTS idx_smtp_connection_audit_provider_time ON smtp_connection_audit(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_health_snapshots_time ON email_health_snapshots(created_at DESC);

-- Add RLS policies
ALTER TABLE smtp_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_connection_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_health_snapshots ENABLE ROW LEVEL SECURITY;

-- Admin-only access to SMTP provider configs
CREATE POLICY "Admin can manage SMTP providers" ON smtp_provider_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Admin-only access to connection audit
CREATE POLICY "Admin can view connection audit" ON smtp_connection_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Service role can insert audit records
CREATE POLICY "Service can insert connection audit" ON smtp_connection_audit
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Admin-only access to health snapshots
CREATE POLICY "Admin can view health snapshots" ON email_health_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Service role can insert health snapshots
CREATE POLICY "Service can insert health snapshots" ON email_health_snapshots
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Insert default SMTP provider from existing settings
INSERT INTO smtp_provider_configs (
  name,
  host,
  port,
  secure,
  auth_user,
  auth_pass,
  sender_email,
  sender_name,
  is_primary
)
SELECT 
  'Primary SMTP Provider',
  smtp_host,
  smtp_port,
  smtp_secure,
  smtp_user,
  smtp_pass,
  sender_email,
  sender_name,
  true
FROM communication_settings 
WHERE use_smtp = true 
LIMIT 1
ON CONFLICT DO NOTHING;