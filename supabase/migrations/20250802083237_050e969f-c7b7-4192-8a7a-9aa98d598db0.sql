-- Phase 2 & 3: Production-Ready Email System Enhancements

-- Create email delivery confirmations table for tracking
CREATE TABLE IF NOT EXISTS public.email_delivery_confirmations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  communication_event_id UUID REFERENCES public.communication_events(id),
  provider_message_id TEXT,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('sent', 'delivered', 'bounced', 'complained', 'suppressed')),
  delivery_timestamp TIMESTAMP WITH TIME ZONE,
  provider_response JSONB,
  error_code TEXT,
  error_message TEXT,
  recipient_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on email delivery confirmations
ALTER TABLE public.email_delivery_confirmations ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage delivery confirmations
CREATE POLICY "Admins can manage email delivery confirmations" 
ON public.email_delivery_confirmations 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- Create policy for service roles to insert delivery confirmations
CREATE POLICY "Service roles can insert delivery confirmations" 
ON public.email_delivery_confirmations 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- Create email processing metrics table for analytics
CREATE TABLE IF NOT EXISTS public.email_processing_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  total_queued INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  delivery_rate NUMERIC(5,2) DEFAULT 0,
  bounce_rate NUMERIC(5,2) DEFAULT 0,
  average_processing_time INTEGER, -- in seconds
  peak_queue_size INTEGER DEFAULT 0,
  error_categories JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date)
);

-- Enable RLS on email processing metrics
ALTER TABLE public.email_processing_metrics ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view metrics
CREATE POLICY "Admins can view email processing metrics" 
ON public.email_processing_metrics 
FOR SELECT 
USING (is_admin());

-- Create policy for service roles to manage metrics
CREATE POLICY "Service roles can manage email processing metrics" 
ON public.email_processing_metrics 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create email rate limits table for production safeguards
CREATE TABLE IF NOT EXISTS public.email_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL, -- email address or user ID
  email_type TEXT NOT NULL CHECK (email_type IN ('transactional', 'marketing', 'promotional')),
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('hour', now()),
  request_count INTEGER NOT NULL DEFAULT 1,
  limit_per_hour INTEGER NOT NULL DEFAULT 10,
  limit_per_day INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(identifier, email_type, window_start)
);

-- Enable RLS on email rate limits
ALTER TABLE public.email_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policy for service roles to manage rate limits
CREATE POLICY "Service roles can manage email rate limits" 
ON public.email_rate_limits 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create admin notification preferences table
CREATE TABLE IF NOT EXISTS public.admin_notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES public.profiles(id),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('email_failure', 'high_bounce_rate', 'queue_backup', 'security_alert')),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  threshold_value NUMERIC,
  notification_channel TEXT NOT NULL DEFAULT 'email' CHECK (notification_channel IN ('email', 'sms', 'slack')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(admin_id, notification_type)
);

-- Enable RLS on admin notification preferences
ALTER TABLE public.admin_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage their own notification preferences
CREATE POLICY "Admins can manage their own notification preferences" 
ON public.admin_notification_preferences 
FOR ALL 
USING (admin_id = auth.uid() AND is_admin())
WITH CHECK (admin_id = auth.uid() AND is_admin());

-- Add admin_notification_email to business_settings if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'business_settings' 
                 AND column_name = 'admin_notification_email') THEN
    ALTER TABLE public.business_settings 
    ADD COLUMN admin_notification_email TEXT;
  END IF;
END $$;

-- Add site_url to business_settings for dynamic URL resolution
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'business_settings' 
                 AND column_name = 'site_url') THEN
    ALTER TABLE public.business_settings 
    ADD COLUMN site_url TEXT DEFAULT 'https://oknnklksdiqaifhxaccs.supabase.co';
  END IF;
END $$;

-- Create function to calculate daily email metrics
CREATE OR REPLACE FUNCTION public.calculate_daily_email_metrics(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  metrics JSONB;
  total_queued INTEGER;
  total_sent INTEGER;
  total_delivered INTEGER;
  total_failed INTEGER;
  total_bounced INTEGER;
  delivery_rate NUMERIC;
  bounce_rate NUMERIC;
  avg_processing_time INTEGER;
  peak_queue INTEGER;
  error_categories JSONB;
BEGIN
  -- Calculate metrics for the target date
  SELECT 
    COUNT(*) FILTER (WHERE status = 'queued'),
    COUNT(*) FILTER (WHERE status = 'sent'),
    COUNT(*) FILTER (WHERE delivery_status = 'delivered'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE delivery_status = 'bounced')
  INTO total_queued, total_sent, total_delivered, total_failed, total_bounced
  FROM communication_events ce
  LEFT JOIN email_delivery_confirmations edc ON ce.id = edc.communication_event_id
  WHERE DATE(ce.created_at) = target_date;

  -- Calculate rates
  delivery_rate := CASE WHEN total_sent > 0 THEN (total_delivered::NUMERIC / total_sent) * 100 ELSE 0 END;
  bounce_rate := CASE WHEN total_sent > 0 THEN (total_bounced::NUMERIC / total_sent) * 100 ELSE 0 END;

  -- Calculate average processing time
  SELECT AVG(EXTRACT(EPOCH FROM (processed_at - created_at)))::INTEGER
  INTO avg_processing_time
  FROM communication_events
  WHERE DATE(created_at) = target_date AND processed_at IS NOT NULL;

  -- Get peak queue size (approximate)
  SELECT COALESCE(MAX(retry_count + 1), 0)
  INTO peak_queue
  FROM communication_events
  WHERE DATE(created_at) = target_date;

  -- Categorize errors
  SELECT jsonb_object_agg(
    COALESCE(error_message, 'unknown'), 
    COUNT(*)
  )
  INTO error_categories
  FROM communication_events
  WHERE DATE(created_at) = target_date 
    AND status = 'failed'
    AND error_message IS NOT NULL;

  -- Upsert metrics
  INSERT INTO email_processing_metrics (
    date, total_queued, total_sent, total_delivered, total_failed, total_bounced,
    delivery_rate, bounce_rate, average_processing_time, peak_queue_size, error_categories
  ) VALUES (
    target_date, total_queued, total_sent, total_delivered, total_failed, total_bounced,
    delivery_rate, bounce_rate, avg_processing_time, peak_queue, COALESCE(error_categories, '{}')
  )
  ON CONFLICT (date) DO UPDATE SET
    total_queued = EXCLUDED.total_queued,
    total_sent = EXCLUDED.total_sent,
    total_delivered = EXCLUDED.total_delivered,
    total_failed = EXCLUDED.total_failed,
    total_bounced = EXCLUDED.total_bounced,
    delivery_rate = EXCLUDED.delivery_rate,
    bounce_rate = EXCLUDED.bounce_rate,
    average_processing_time = EXCLUDED.average_processing_time,
    peak_queue_size = EXCLUDED.peak_queue_size,
    error_categories = EXCLUDED.error_categories,
    updated_at = now();

  RETURN jsonb_build_object(
    'date', target_date,
    'total_queued', total_queued,
    'total_sent', total_sent,
    'total_delivered', total_delivered,
    'total_failed', total_failed,
    'delivery_rate', delivery_rate,
    'bounce_rate', bounce_rate
  );
END;
$$;

-- Create function to check email rate limits
CREATE OR REPLACE FUNCTION public.check_email_rate_limit(
  p_identifier TEXT,
  p_email_type TEXT DEFAULT 'transactional'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  hourly_count INTEGER;
  daily_count INTEGER;
  hourly_limit INTEGER := CASE WHEN p_email_type = 'transactional' THEN 50 ELSE 10 END;
  daily_limit INTEGER := CASE WHEN p_email_type = 'transactional' THEN 200 ELSE 50 END;
  current_hour TIMESTAMP WITH TIME ZONE := date_trunc('hour', now());
  current_day DATE := CURRENT_DATE;
BEGIN
  -- Check hourly limit
  SELECT COALESCE(SUM(request_count), 0)
  INTO hourly_count
  FROM email_rate_limits
  WHERE identifier = p_identifier
    AND email_type = p_email_type
    AND window_start >= current_hour;

  -- Check daily limit
  SELECT COALESCE(SUM(request_count), 0)
  INTO daily_count
  FROM email_rate_limits
  WHERE identifier = p_identifier
    AND email_type = p_email_type
    AND window_start >= current_day::TIMESTAMP WITH TIME ZONE;

  -- Return false if limits exceeded
  IF hourly_count >= hourly_limit OR daily_count >= daily_limit THEN
    RETURN false;
  END IF;

  -- Increment counter
  INSERT INTO email_rate_limits (identifier, email_type, window_start, request_count, limit_per_hour, limit_per_day)
  VALUES (p_identifier, p_email_type, current_hour, 1, hourly_limit, daily_limit)
  ON CONFLICT (identifier, email_type, window_start)
  DO UPDATE SET 
    request_count = email_rate_limits.request_count + 1,
    created_at = now();

  RETURN true;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_delivery_confirmations_event_id ON public.email_delivery_confirmations(communication_event_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_confirmations_status ON public.email_delivery_confirmations(delivery_status);
CREATE INDEX IF NOT EXISTS idx_email_delivery_confirmations_created_at ON public.email_delivery_confirmations(created_at);
CREATE INDEX IF NOT EXISTS idx_email_processing_metrics_date ON public.email_processing_metrics(date);
CREATE INDEX IF NOT EXISTS idx_email_rate_limits_identifier ON public.email_rate_limits(identifier, email_type, window_start);
CREATE INDEX IF NOT EXISTS idx_communication_events_status_created ON public.communication_events(status, created_at);

-- Log the Phase 2 & 3 implementation
INSERT INTO audit_logs (action, category, message, new_values) 
VALUES (
  'email_system_phase_2_3_implementation', 
  'System Enhancement', 
  'Implemented Phase 2 & 3: Production-ready email system with enhanced monitoring, security, and performance features',
  jsonb_build_object(
    'new_tables', ARRAY['email_delivery_confirmations', 'email_processing_metrics', 'email_rate_limits', 'admin_notification_preferences'],
    'new_functions', ARRAY['calculate_daily_email_metrics', 'check_email_rate_limit'],
    'new_columns', ARRAY['admin_notification_email', 'site_url'],
    'features', ARRAY['delivery_tracking', 'rate_limiting', 'admin_notifications', 'metrics_analytics', 'dynamic_url_resolution']
  )
);