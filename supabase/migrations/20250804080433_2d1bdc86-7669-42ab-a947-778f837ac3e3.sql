-- Security hardening and email system improvements

-- Add missing RLS policies for email security
ALTER TABLE email_bounce_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bounce tracking" 
ON email_bounce_tracking 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Service roles can manage bounce tracking" 
ON email_bounce_tracking 
FOR ALL 
TO service_role 
USING (true);

-- Enhanced email bounce tracking table
CREATE TABLE IF NOT EXISTS email_bounce_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address TEXT NOT NULL,
  bounce_type TEXT NOT NULL CHECK (bounce_type IN ('hard', 'soft', 'complaint', 'block')),
  bounce_count INTEGER DEFAULT 1,
  first_bounce_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_bounce_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  bounce_reason TEXT,
  provider_response JSONB,
  is_suppressed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index for email bounce tracking
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_bounce_tracking_email_type 
ON email_bounce_tracking(email_address, bounce_type);

-- Enhanced SMTP delivery confirmations with better tracking
CREATE TABLE IF NOT EXISTS smtp_delivery_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('delivered', 'bounced', 'complained', 'blocked', 'deferred')),
  provider_response JSONB,
  delivered_at TIMESTAMP WITH TIME ZONE,
  bounce_reason TEXT,
  complaint_feedback TEXT,
  reputation_impact NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for SMTP delivery confirmations
ALTER TABLE smtp_delivery_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view delivery confirmations" 
ON smtp_delivery_confirmations 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Service roles can manage delivery confirmations" 
ON smtp_delivery_confirmations 
FOR ALL 
TO service_role 
USING (true);

-- Enhanced rate limiting with reputation-based throttling
CREATE TABLE IF NOT EXISTS enhanced_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- email domain or IP
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('domain', 'ip', 'user')),
  limit_type TEXT NOT NULL CHECK (limit_type IN ('hourly', 'daily', 'burst')),
  current_count INTEGER DEFAULT 0,
  limit_threshold INTEGER NOT NULL,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  reputation_score INTEGER DEFAULT 100,
  violation_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS for enhanced rate limits
ALTER TABLE enhanced_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service roles can manage rate limits" 
ON enhanced_rate_limits 
FOR ALL 
TO service_role 
USING (true);

-- Email suppression list for bounce management
CREATE TABLE IF NOT EXISTS email_suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address TEXT UNIQUE NOT NULL,
  suppression_reason TEXT NOT NULL CHECK (suppression_reason IN ('hard_bounce', 'complaint', 'unsubscribe', 'invalid', 'blocked')),
  suppressed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  bounce_count INTEGER DEFAULT 0,
  last_bounce_at TIMESTAMP WITH TIME ZONE,
  can_retry_after TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS for suppression list
ALTER TABLE email_suppression_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage suppression list" 
ON email_suppression_list 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Service roles can manage suppression list" 
ON email_suppression_list 
FOR ALL 
TO service_role 
USING (true);

-- Enhanced SMTP health metrics
CREATE TABLE IF NOT EXISTS smtp_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('connection_time', 'success_rate', 'bounce_rate', 'complaint_rate', 'throughput')),
  metric_value NUMERIC NOT NULL,
  measurement_window TEXT NOT NULL CHECK (measurement_window IN ('1h', '6h', '24h', '7d')),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Add RLS for health metrics
ALTER TABLE smtp_health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view health metrics" 
ON smtp_health_metrics 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Service roles can insert health metrics" 
ON smtp_health_metrics 
FOR INSERT 
TO service_role 
WITH CHECK (true);

-- Function to check if email is suppressed (secure version)
CREATE OR REPLACE FUNCTION public.is_email_suppressed_secure(email_address text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.email_suppression_list 
    WHERE email_address = $1
    AND (can_retry_after IS NULL OR can_retry_after > NOW())
  );
$function$;

-- Function to record SMTP health metrics
CREATE OR REPLACE FUNCTION public.record_smtp_health_metric(
  p_provider_name TEXT,
  p_metric_type TEXT,
  p_metric_value NUMERIC,
  p_measurement_window TEXT DEFAULT '1h',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_metric_id UUID;
BEGIN
  INSERT INTO public.smtp_health_metrics (
    provider_name, metric_type, metric_value, measurement_window, metadata
  ) VALUES (
    p_provider_name, p_metric_type, p_metric_value, p_measurement_window, p_metadata
  ) RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$function$;

-- Function to increment rate limit counter
CREATE OR REPLACE FUNCTION public.increment_rate_limit_counter(
  p_identifier TEXT,
  p_identifier_type TEXT DEFAULT 'domain',
  p_limit_type TEXT DEFAULT 'hourly'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_count INTEGER;
  v_limit_threshold INTEGER;
  v_window_duration INTERVAL;
BEGIN
  -- Set window duration based on limit type
  CASE p_limit_type
    WHEN 'hourly' THEN v_window_duration := '1 hour'::INTERVAL;
    WHEN 'daily' THEN v_window_duration := '1 day'::INTERVAL;
    WHEN 'burst' THEN v_window_duration := '1 minute'::INTERVAL;
    ELSE v_window_duration := '1 hour'::INTERVAL;
  END CASE;

  -- Get or create rate limit record
  INSERT INTO public.enhanced_rate_limits (
    identifier, identifier_type, limit_type, limit_threshold, window_end
  ) VALUES (
    p_identifier, p_identifier_type, p_limit_type, 
    CASE p_limit_type 
      WHEN 'hourly' THEN 100
      WHEN 'daily' THEN 1000  
      WHEN 'burst' THEN 10
      ELSE 100
    END,
    NOW() + v_window_duration
  )
  ON CONFLICT (identifier, identifier_type, limit_type) 
  DO UPDATE SET 
    current_count = enhanced_rate_limits.current_count + 1,
    updated_at = NOW()
  RETURNING current_count, limit_threshold INTO v_current_count, v_limit_threshold;

  -- Check if within limits
  RETURN v_current_count <= v_limit_threshold;
END;
$function$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_bounce_tracking_email ON email_bounce_tracking(email_address);
CREATE INDEX IF NOT EXISTS idx_email_bounce_tracking_type ON email_bounce_tracking(bounce_type);
CREATE INDEX IF NOT EXISTS idx_smtp_delivery_confirmations_email ON smtp_delivery_confirmations(recipient_email);
CREATE INDEX IF NOT EXISTS idx_smtp_delivery_confirmations_status ON smtp_delivery_confirmations(delivery_status);
CREATE INDEX IF NOT EXISTS idx_enhanced_rate_limits_identifier ON enhanced_rate_limits(identifier, identifier_type);
CREATE INDEX IF NOT EXISTS idx_email_suppression_list_email ON email_suppression_list(email_address);
CREATE INDEX IF NOT EXISTS idx_smtp_health_metrics_provider ON smtp_health_metrics(provider_name, recorded_at);

-- Add unique constraint for rate limits
ALTER TABLE enhanced_rate_limits 
ADD CONSTRAINT unique_rate_limit_identifier 
UNIQUE (identifier, identifier_type, limit_type);

-- Insert audit log for security hardening
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'email_security_hardening',
  'Email System',
  'Enhanced email system security with RLS policies, bounce management, and rate limiting',
  jsonb_build_object(
    'tables_secured', ARRAY['email_bounce_tracking', 'smtp_delivery_confirmations', 'enhanced_rate_limits', 'email_suppression_list', 'smtp_health_metrics'],
    'functions_added', ARRAY['is_email_suppressed_secure', 'record_smtp_health_metric', 'increment_rate_limit_counter']
  )
);