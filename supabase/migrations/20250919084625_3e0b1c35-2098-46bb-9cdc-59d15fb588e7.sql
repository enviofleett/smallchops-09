-- Fix RLS for collision monitoring table
ALTER TABLE communication_events_collision_log ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for collision monitoring (admin-only access)
CREATE POLICY "Admins can view collision logs" 
ON communication_events_collision_log
FOR SELECT
USING (is_admin());

CREATE POLICY "Service roles can manage collision logs" 
ON communication_events_collision_log
FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);