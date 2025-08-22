-- Add system health checks table for monitoring
CREATE TABLE IF NOT EXISTS public.system_health_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'critical', 'unknown')),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_system_health_checks_service_created_at 
ON public.system_health_checks (service, created_at DESC);

-- Enable RLS
ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;

-- Create policies for system health checks
CREATE POLICY "Admins can view system health checks" 
ON public.system_health_checks 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Service roles can insert health checks" 
ON public.system_health_checks 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- Add function to cleanup old health check records (keep last 1000 per service)
CREATE OR REPLACE FUNCTION public.cleanup_old_health_checks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Keep only the last 1000 records per service
  DELETE FROM system_health_checks 
  WHERE id NOT IN (
    SELECT id FROM (
      SELECT id, 
             ROW_NUMBER() OVER (PARTITION BY service ORDER BY created_at DESC) as rn
      FROM system_health_checks
    ) ranked 
    WHERE rn <= 1000
  );
END;
$$;