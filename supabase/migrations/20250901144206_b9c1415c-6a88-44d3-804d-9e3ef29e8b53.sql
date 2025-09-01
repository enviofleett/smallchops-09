-- Add circuit breaker status to communication_events for observability
ALTER TABLE communication_events ADD COLUMN IF NOT EXISTS circuit_breaker_triggered boolean DEFAULT false;

-- Create delivery logs table if not exists with RLS
CREATE TABLE IF NOT EXISTS smtp_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  subject text,
  delivery_status text NOT NULL,
  smtp_response text,
  error_message text,
  delivery_timestamp timestamptz NOT NULL DEFAULT now(),
  sender_email text,
  provider text,
  template_key text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on smtp_delivery_logs
ALTER TABLE smtp_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for smtp_delivery_logs
CREATE POLICY "Admins can view all delivery logs" ON smtp_delivery_logs 
FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can manage delivery logs" ON smtp_delivery_logs 
FOR ALL USING (auth.role() = 'service_role');

-- Create health metrics table if not exists with RLS
CREATE TABLE IF NOT EXISTS smtp_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL,
  metric_type text NOT NULL,
  metric_value numeric NOT NULL,
  threshold_value numeric,
  threshold_breached boolean DEFAULT false,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on smtp_health_metrics  
ALTER TABLE smtp_health_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for smtp_health_metrics
CREATE POLICY "Admins can view health metrics" ON smtp_health_metrics 
FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can manage health metrics" ON smtp_health_metrics 
FOR ALL USING (auth.role() = 'service_role');

-- Ensure communication_events has proper RLS for service roles
DROP POLICY IF EXISTS "Service role can read communication events" ON communication_events;
CREATE POLICY "Service role can read communication events" ON communication_events 
FOR SELECT USING (auth.role() = 'service_role' OR is_admin());

-- Add index for performance on delivery logs
CREATE INDEX IF NOT EXISTS idx_smtp_delivery_logs_timestamp ON smtp_delivery_logs(delivery_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_smtp_delivery_logs_status ON smtp_delivery_logs(delivery_status);
CREATE INDEX IF NOT EXISTS idx_smtp_delivery_logs_recipient ON smtp_delivery_logs(recipient_email);