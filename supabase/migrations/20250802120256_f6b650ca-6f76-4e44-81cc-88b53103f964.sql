-- Create email health metrics table for production monitoring
CREATE TABLE IF NOT EXISTS public.email_health_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_events INTEGER NOT NULL DEFAULT 0,
  sent_events INTEGER NOT NULL DEFAULT 0,
  failed_events INTEGER NOT NULL DEFAULT 0,
  delivery_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  period TEXT NOT NULL DEFAULT 'hourly',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_health_metrics_timestamp ON public.email_health_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_email_health_metrics_period ON public.email_health_metrics(period);

-- Enable RLS
ALTER TABLE public.email_health_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access only
CREATE POLICY "Admins can view email health metrics" ON public.email_health_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert email health metrics" ON public.email_health_metrics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create function to calculate daily email metrics
CREATE OR REPLACE FUNCTION public.calculate_daily_email_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  today_start TIMESTAMP WITH TIME ZONE;
  today_end TIMESTAMP WITH TIME ZONE;
  total_count INTEGER;
  sent_count INTEGER;
  failed_count INTEGER;
  delivery_rate_calc NUMERIC;
BEGIN
  -- Calculate for today
  today_start := date_trunc('day', now());
  today_end := today_start + interval '1 day';
  
  -- Get counts for today
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'sent'),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO total_count, sent_count, failed_count
  FROM communication_events
  WHERE created_at >= today_start AND created_at < today_end;
  
  -- Calculate delivery rate
  delivery_rate_calc := CASE 
    WHEN total_count > 0 THEN (sent_count::NUMERIC / total_count) * 100
    ELSE 100
  END;
  
  -- Insert or update daily metrics
  INSERT INTO email_health_metrics (
    timestamp,
    total_events,
    sent_events,
    failed_events,
    delivery_rate,
    period
  ) VALUES (
    today_start,
    total_count,
    sent_count,
    failed_count,
    delivery_rate_calc,
    'daily'
  ) ON CONFLICT (timestamp, period) DO UPDATE SET
    total_events = EXCLUDED.total_events,
    sent_events = EXCLUDED.sent_events,
    failed_events = EXCLUDED.failed_events,
    delivery_rate = EXCLUDED.delivery_rate;
END;
$function$;

-- Create function to check email rate limits with domain-based tracking
CREATE OR REPLACE FUNCTION public.check_email_rate_limit(
  p_identifier text,
  p_email_type text DEFAULT 'transactional'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
  v_limit INTEGER;
  v_domain TEXT;
BEGIN
  -- Extract domain from email
  v_domain := split_part(p_identifier, '@', 2);
  
  -- Set limits based on email type
  CASE p_email_type
    WHEN 'marketing' THEN v_limit := 100; -- 100 marketing emails per hour
    WHEN 'transactional' THEN v_limit := 500; -- 500 transactional emails per hour
    ELSE v_limit := 300; -- Default limit
  END CASE;
  
  -- Count emails sent in the last hour to this domain
  SELECT COUNT(*) INTO v_count
  FROM communication_events
  WHERE recipient_email LIKE '%@' || v_domain
    AND status = 'sent'
    AND sent_at > now() - interval '1 hour';
    
  -- Return true if under limit
  RETURN v_count < v_limit;
END;
$function$;

-- Add unique constraint for metrics
ALTER TABLE public.email_health_metrics 
ADD CONSTRAINT unique_timestamp_period UNIQUE (timestamp, period);

-- Log the creation
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'production_monitoring_setup',
  'System Enhancement',
  'Production monitoring tables and functions created for email health tracking',
  jsonb_build_object(
    'timestamp', now(),
    'tables_created', ARRAY['email_health_metrics'],
    'functions_created', ARRAY['calculate_daily_email_metrics', 'check_email_rate_limit']
  )
);