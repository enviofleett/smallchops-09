-- Enhanced Email System Implementation (without cron dependencies)

-- Create enhanced email processing configuration
CREATE TABLE IF NOT EXISTS public.enhanced_email_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  use_enhanced_smtp BOOLEAN DEFAULT true,
  fallback_ports INTEGER[] DEFAULT ARRAY[587, 465, 25],
  retry_intervals INTEGER[] DEFAULT ARRAY[30, 120, 300, 900],
  max_retries INTEGER DEFAULT 4,
  instant_processing_enabled BOOLEAN DEFAULT true,
  batch_size INTEGER DEFAULT 50,
  processing_interval_seconds INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO public.enhanced_email_config (id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.enhanced_email_config ENABLE ROW LEVEL SECURITY;

-- Create policy for admins
CREATE POLICY "Admins can manage enhanced email config"
ON public.enhanced_email_config
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Create email processing queue with priority handling
CREATE TABLE IF NOT EXISTS public.email_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.communication_events(id) ON DELETE CASCADE,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for processing queue
ALTER TABLE public.email_processing_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for processing queue
CREATE POLICY "Service roles can manage processing queue"
ON public.email_processing_queue
FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view processing queue"
ON public.email_processing_queue
FOR SELECT
USING (is_admin());

-- Create enhanced SMTP health monitoring
CREATE TABLE IF NOT EXISTS public.smtp_health_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL,
  connection_success BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  ssl_status BOOLEAN,
  authentication_success BOOLEAN,
  test_email_sent BOOLEAN DEFAULT false,
  health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for SMTP health monitoring
ALTER TABLE public.smtp_health_monitoring ENABLE ROW LEVEL SECURITY;

-- Create policy for SMTP health monitoring
CREATE POLICY "Service roles can insert SMTP health data"
ON public.smtp_health_monitoring
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view SMTP health data"
ON public.smtp_health_monitoring
FOR SELECT
USING (is_admin());

-- Create function to trigger enhanced email processing
CREATE OR REPLACE FUNCTION public.trigger_enhanced_email_processing()
RETURNS TRIGGER AS $$
DECLARE
  config_record RECORD;
BEGIN
  -- Get enhanced email configuration
  SELECT * INTO config_record FROM public.enhanced_email_config LIMIT 1;
  
  -- Only trigger for queued events if enhanced processing is enabled
  IF NEW.status = 'queued' AND COALESCE(config_record.instant_processing_enabled, true) THEN
    -- Add to processing queue with appropriate priority
    INSERT INTO public.email_processing_queue (
      event_id,
      priority,
      scheduled_for,
      max_attempts
    ) VALUES (
      NEW.id,
      CASE 
        WHEN NEW.priority = 'high' OR NEW.event_type = 'customer_welcome' THEN 'high'
        WHEN NEW.priority = 'low' THEN 'low'
        ELSE 'normal'
      END,
      NOW(),
      COALESCE(config_record.max_retries, 3)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for enhanced email processing
DROP TRIGGER IF EXISTS trigger_enhanced_email_processing ON public.communication_events;
CREATE TRIGGER trigger_enhanced_email_processing
  AFTER INSERT OR UPDATE ON public.communication_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_enhanced_email_processing();

-- Create function for manual email queue processing
CREATE OR REPLACE FUNCTION public.process_email_queue_manual(batch_size INTEGER DEFAULT 50)
RETURNS JSONB AS $$
DECLARE
  processed_count INTEGER := 0;
  failed_count INTEGER := 0;
  queue_record RECORD;
  result JSONB;
BEGIN
  -- Process high priority emails first
  FOR queue_record IN
    SELECT epq.*, ce.recipient_email, ce.event_type
    FROM public.email_processing_queue epq
    JOIN public.communication_events ce ON epq.event_id = ce.id
    WHERE epq.status = 'queued'
    AND epq.scheduled_for <= NOW()
    AND epq.attempts < epq.max_attempts
    ORDER BY 
      CASE epq.priority 
        WHEN 'high' THEN 1 
        WHEN 'normal' THEN 2 
        WHEN 'low' THEN 3 
      END,
      epq.created_at
    LIMIT batch_size
  LOOP
    BEGIN
      -- Update status to processing
      UPDATE public.email_processing_queue
      SET status = 'processing',
          last_attempt_at = NOW(),
          attempts = attempts + 1,
          updated_at = NOW()
      WHERE id = queue_record.id;
      
      -- Mark as completed (actual processing will be done by edge functions)
      UPDATE public.email_processing_queue
      SET status = 'completed',
          updated_at = NOW()
      WHERE id = queue_record.id;
      
      processed_count := processed_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Calculate next retry time with exponential backoff
        UPDATE public.email_processing_queue
        SET status = CASE 
                      WHEN attempts >= max_attempts THEN 'failed'
                      ELSE 'queued'
                    END,
            next_retry_at = CASE 
                             WHEN attempts < max_attempts THEN 
                               NOW() + (INTERVAL '1 minute' * POWER(2, attempts))
                             ELSE NULL
                           END,
            error_details = jsonb_build_object(
              'error', SQLERRM,
              'timestamp', NOW(),
              'attempt', attempts
            ),
            updated_at = NOW()
        WHERE id = queue_record.id;
        
        failed_count := failed_count + 1;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'processed', processed_count,
    'failed', failed_count,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create cleanup function for old email events
CREATE OR REPLACE FUNCTION public.cleanup_email_processing_data()
RETURNS VOID AS $$
BEGIN
  -- Clean up completed queue items older than 7 days
  DELETE FROM public.email_processing_queue
  WHERE status = 'completed'
  AND updated_at < NOW() - INTERVAL '7 days';
  
  -- Clean up old SMTP health monitoring data (keep 30 days)
  DELETE FROM public.smtp_health_monitoring
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Clean up old communication events (keep 90 days, except failed ones)
  DELETE FROM public.communication_events
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND status != 'failed';
  
  -- Log cleanup operation
  INSERT INTO public.audit_logs (action, category, message)
  VALUES ('enhanced_email_cleanup', 'System Maintenance', 'Cleaned up old email processing data');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_processing_queue_status_priority 
ON public.email_processing_queue(status, priority, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_email_processing_queue_event_id 
ON public.email_processing_queue(event_id);

CREATE INDEX IF NOT EXISTS idx_smtp_health_monitoring_timestamp 
ON public.smtp_health_monitoring(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_communication_events_priority_status 
ON public.communication_events(priority, status, created_at);