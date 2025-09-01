-- Fix policy conflicts by using CREATE OR REPLACE
DROP POLICY IF EXISTS "Admins can view health metrics" ON smtp_health_metrics;
DROP POLICY IF EXISTS "Service roles can manage health metrics" ON smtp_health_metrics;

-- Create RLS policies for smtp_health_metrics with conflict resolution
CREATE POLICY "Admins can view health metrics" ON smtp_health_metrics 
FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can manage health metrics" ON smtp_health_metrics 
FOR ALL USING (auth.role() = 'service_role');