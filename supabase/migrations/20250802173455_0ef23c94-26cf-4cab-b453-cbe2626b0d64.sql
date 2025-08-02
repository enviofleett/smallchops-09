-- Create debug_logs table for registration monitoring
CREATE TABLE IF NOT EXISTS public.debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL DEFAULT 'info',
  category TEXT NOT NULL DEFAULT 'system',
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all debug logs" 
ON public.debug_logs FOR SELECT 
USING (is_admin());

CREATE POLICY "Service roles can insert debug logs" 
ON public.debug_logs FOR INSERT 
WITH CHECK (auth.role() = 'service_role' OR TRUE);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_debug_logs_timestamp ON public.debug_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_debug_logs_category ON public.debug_logs(category);
CREATE INDEX IF NOT EXISTS idx_debug_logs_level ON public.debug_logs(level);

-- Add registration monitoring function (fixed parameter order)
CREATE OR REPLACE FUNCTION public.log_registration_debug(
  p_message TEXT,
  p_level TEXT DEFAULT 'info',
  p_category TEXT DEFAULT 'registration',
  p_details JSONB DEFAULT '{}',
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.debug_logs (
    level, category, message, details, user_id, 
    session_id, ip_address, user_agent
  ) VALUES (
    p_level, p_category, p_message, p_details, p_user_id,
    p_session_id, p_ip_address, p_user_agent
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;