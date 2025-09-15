-- Fix audit_logs table schema for production compatibility
-- Add missing created_at and updated_at columns that edge functions expect

ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing records to have created_at based on event_time
UPDATE public.audit_logs 
SET created_at = event_time 
WHERE created_at IS NULL;

-- Add trigger to automatically set updated_at
CREATE OR REPLACE FUNCTION update_audit_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_logs_updated_at
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_logs_updated_at();

-- Ensure drivers table has proper indexes for production performance
CREATE INDEX IF NOT EXISTS idx_drivers_active 
ON public.drivers (is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_drivers_name 
ON public.drivers (name);

-- Log the production compatibility fix
INSERT INTO public.audit_logs (action, category, message, new_values)
VALUES (
  'production_compatibility_fix',
  'Database Schema',
  'Fixed audit_logs table schema and added performance indexes for production',
  jsonb_build_object(
    'tables_updated', array['audit_logs', 'drivers'],
    'columns_added', array['created_at', 'updated_at'],
    'indexes_added', array['idx_drivers_active', 'idx_drivers_name'],
    'timestamp', now()
  )
);