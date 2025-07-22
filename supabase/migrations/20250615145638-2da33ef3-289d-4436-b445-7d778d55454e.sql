
-- Create a table to store map API settings and usage limits
CREATE TABLE public.map_settings (
  id INT PRIMARY KEY DEFAULT 1,
  monthly_usage_limit INT,
  usage_alert_email TEXT,
  usage_alert_threshold INT CHECK (usage_alert_threshold >= 0 AND usage_alert_threshold <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton_map_settings CHECK (id = 1)
);

-- Create a table to log API usage
CREATE TABLE public.map_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  feature_used TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  count INT NOT NULL DEFAULT 1
);

-- Enable Row-Level Security for the new tables
ALTER TABLE public.map_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_api_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for map_settings: Only admins can manage.
CREATE POLICY "Admins can manage map settings"
ON public.map_settings
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- RLS Policies for map_api_usage: Only admins can read.
CREATE POLICY "Admins can view map usage data"
ON public.map_api_usage
FOR SELECT
USING (public.is_admin());

-- The edge function will use a service key to insert usage, bypassing RLS.
-- This policy allows admins to manually insert if needed.
CREATE POLICY "Admins can insert map usage"
ON public.map_api_usage
FOR INSERT
WITH CHECK (public.is_admin());

-- Create a trigger to automatically update the 'updated_at' timestamp on map_settings
CREATE TRIGGER set_map_settings_updated_at
BEFORE UPDATE ON public.map_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Insert a default row into map_settings to initialize it
INSERT INTO public.map_settings (id, monthly_usage_limit, usage_alert_email, usage_alert_threshold)
VALUES (1, 100000, null, 80);
