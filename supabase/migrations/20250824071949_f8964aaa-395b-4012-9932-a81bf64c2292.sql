-- Fix critical security issues for SMTP tables

-- Enable RLS on tables that don't have it
ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_health_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_system_health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_batch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_health_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for rate_limit_counters
CREATE POLICY "Service roles can manage rate limits" ON rate_limit_counters
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view rate limits" ON rate_limit_counters 
FOR SELECT USING (is_admin());

-- Create RLS policies for smtp_health_monitoring  
CREATE POLICY "Service roles can manage SMTP health monitoring" ON smtp_health_monitoring
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view SMTP health monitoring" ON smtp_health_monitoring
FOR SELECT USING (is_admin());

-- Create RLS policies for email_system_health_logs
CREATE POLICY "Service roles can manage email system health logs" ON email_system_health_logs
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view email system health logs" ON email_system_health_logs
FOR SELECT USING (is_admin());

-- Create RLS policies for email_dead_letter_queue
CREATE POLICY "Service roles can manage dead letter queue" ON email_dead_letter_queue
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view dead letter queue" ON email_dead_letter_queue
FOR SELECT USING (is_admin());

-- Create RLS policies for email_processing_queue
CREATE POLICY "Service roles can manage processing queue" ON email_processing_queue
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view processing queue" ON email_processing_queue
FOR SELECT USING (is_admin());

-- Create RLS policies for email_batch_logs
CREATE POLICY "Service roles can manage batch logs" ON email_batch_logs
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view batch logs" ON email_batch_logs
FOR SELECT USING (is_admin());

-- Create RLS policies for smtp_health_logs
CREATE POLICY "Service roles can manage SMTP health logs" ON smtp_health_logs
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view SMTP health logs" ON smtp_health_logs
FOR SELECT USING (is_admin());

-- Update search paths for functions that were missing them
-- These functions are already in our migration, so we'll update them

-- Update the main email provider function
DROP FUNCTION IF EXISTS public.get_active_email_provider();
CREATE OR REPLACE FUNCTION public.get_active_email_provider()
RETURNS TABLE(provider_name text, health_score numeric, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    spc.provider_name,
    spc.health_score,
    spc.is_active
  FROM smtp_provider_configs spc
  WHERE spc.is_active = true
  ORDER BY spc.health_score DESC, spc.last_checked DESC
  LIMIT 1;
END;
$$;