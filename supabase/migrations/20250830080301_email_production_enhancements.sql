-- Production Email System Enhancements
-- This migration adds missing tables and functions for production-ready email system

-- Ensure email_suppression_list table exists with proper structure
CREATE TABLE IF NOT EXISTS public.email_suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  suppression_type text NOT NULL CHECK (suppression_type IN ('bounce', 'complaint', 'manual', 'hard_bounce', 'soft_bounce')),
  reason text,
  is_active boolean DEFAULT true,
  suppressed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS for suppression list
ALTER TABLE public.email_suppression_list ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for suppression list
CREATE POLICY "Admins can manage suppression list" 
  ON public.email_suppression_list 
  FOR ALL USING (is_admin()) 
  WITH CHECK (is_admin());

CREATE POLICY "Service roles can manage suppression list" 
  ON public.email_suppression_list 
  FOR ALL USING (auth.role() = 'service_role') 
  WITH CHECK (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_suppression_list_email_active 
  ON public.email_suppression_list(email, is_active);

CREATE INDEX IF NOT EXISTS idx_email_suppression_list_type_active 
  ON public.email_suppression_list(suppression_type, is_active);

-- Ensure email_bounce_tracking table exists
CREATE TABLE IF NOT EXISTS public.email_bounce_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address text NOT NULL,
  bounce_type text NOT NULL CHECK (bounce_type IN ('hard', 'soft', 'complaint')),
  bounce_count integer DEFAULT 1,
  last_bounce_at timestamptz DEFAULT now(),
  first_bounce_at timestamptz DEFAULT now(),
  bounce_reason text,
  smtp_provider text,
  is_suppressed boolean DEFAULT false,
  suppressed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS for bounce tracking
ALTER TABLE public.email_bounce_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bounce tracking
CREATE POLICY "Admins can manage bounce tracking" 
  ON public.email_bounce_tracking 
  FOR ALL USING (is_admin()) 
  WITH CHECK (is_admin());

CREATE POLICY "Service roles can manage bounce tracking" 
  ON public.email_bounce_tracking 
  FOR ALL USING (auth.role() = 'service_role') 
  WITH CHECK (auth.role() = 'service_role');

-- Create indexes for bounce tracking
CREATE INDEX IF NOT EXISTS idx_email_bounce_tracking_email 
  ON public.email_bounce_tracking(email_address);

CREATE INDEX IF NOT EXISTS idx_email_bounce_tracking_type 
  ON public.email_bounce_tracking(bounce_type);

-- Function to auto-suppress emails based on bounce patterns
CREATE OR REPLACE FUNCTION public.auto_suppress_bounced_email(
  p_email text,
  p_bounce_type text,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_bounce_threshold integer;
  v_complaint_threshold integer;
  v_should_suppress boolean := false;
  v_bounce_record record;
BEGIN
  -- Get thresholds from environment or use defaults
  v_bounce_threshold := COALESCE(current_setting('app.suppress_after_bounces', true)::integer, 3);
  v_complaint_threshold := COALESCE(current_setting('app.suppress_after_complaints', true)::integer, 1);

  -- Get or create bounce tracking record
  SELECT * INTO v_bounce_record
  FROM email_bounce_tracking
  WHERE email_address = lower(p_email) AND bounce_type = p_bounce_type;

  IF FOUND THEN
    -- Update existing record
    UPDATE email_bounce_tracking
    SET 
      bounce_count = bounce_count + 1,
      last_bounce_at = now(),
      bounce_reason = COALESCE(p_reason, bounce_reason),
      updated_at = now()
    WHERE id = v_bounce_record.id
    RETURNING bounce_count INTO v_bounce_record.bounce_count;
  ELSE
    -- Insert new record
    INSERT INTO email_bounce_tracking (
      email_address, bounce_type, bounce_count, 
      first_bounce_at, last_bounce_at, bounce_reason
    ) VALUES (
      lower(p_email), p_bounce_type, 1, 
      now(), now(), p_reason
    ) RETURNING bounce_count INTO v_bounce_record.bounce_count;
  END IF;

  -- Check if we should suppress
  IF p_bounce_type = 'hard' OR 
     (p_bounce_type = 'soft' AND v_bounce_record.bounce_count >= v_bounce_threshold) OR
     (p_bounce_type = 'complaint' AND v_bounce_record.bounce_count >= v_complaint_threshold) THEN
    
    v_should_suppress := true;
    
    -- Add to suppression list
    INSERT INTO email_suppression_list (
      email, suppression_type, reason, is_active, suppressed_at
    ) VALUES (
      lower(p_email), 
      p_bounce_type,
      format('Auto-suppressed after %s %s bounces. Reason: %s', 
             v_bounce_record.bounce_count, p_bounce_type, p_reason),
      true,
      now()
    ) ON CONFLICT (email) DO UPDATE SET
      suppression_type = EXCLUDED.suppression_type,
      reason = EXCLUDED.reason,
      is_active = true,
      suppressed_at = now(),
      updated_at = now();

    -- Mark bounce record as suppressed
    UPDATE email_bounce_tracking
    SET is_suppressed = true, suppressed_at = now(), updated_at = now()
    WHERE id = v_bounce_record.id;
  END IF;

  RETURN v_should_suppress;
END;
$$;

-- Function to get email delivery metrics
CREATE OR REPLACE FUNCTION public.get_email_delivery_metrics(
  p_hours_back integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_cutoff_time timestamptz;
  v_total_sent integer;
  v_total_failed integer;
  v_total_bounced integer;
  v_total_queued integer;
  v_delivery_rate numeric;
  v_failure_rate numeric;
  v_bounce_rate numeric;
BEGIN
  v_cutoff_time := now() - (p_hours_back || ' hours')::interval;

  -- Get counts from communication_events
  SELECT 
    COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
    COUNT(*) FILTER (WHERE status = 'failed' OR status = 'permanently_failed') as failed_count,
    COUNT(*) FILTER (WHERE status = 'queued') as queued_count
  INTO v_total_sent, v_total_failed, v_total_queued
  FROM communication_events
  WHERE created_at >= v_cutoff_time;

  -- Get bounce count from delivery logs
  SELECT COUNT(*) INTO v_total_bounced
  FROM email_delivery_logs
  WHERE created_at >= v_cutoff_time AND status = 'bounced';

  -- Calculate rates
  v_delivery_rate := CASE 
    WHEN (v_total_sent + v_total_failed) > 0 
    THEN (v_total_sent::numeric / (v_total_sent + v_total_failed)) * 100
    ELSE 100 
  END;

  v_failure_rate := CASE 
    WHEN (v_total_sent + v_total_failed) > 0 
    THEN (v_total_failed::numeric / (v_total_sent + v_total_failed)) * 100
    ELSE 0 
  END;

  v_bounce_rate := CASE 
    WHEN v_total_sent > 0 
    THEN (v_total_bounced::numeric / v_total_sent) * 100
    ELSE 0 
  END;

  RETURN jsonb_build_object(
    'time_window_hours', p_hours_back,
    'total_sent', v_total_sent,
    'total_failed', v_total_failed,
    'total_bounced', v_total_bounced,
    'total_queued', v_total_queued,
    'delivery_rate_percent', round(v_delivery_rate, 2),
    'failure_rate_percent', round(v_failure_rate, 2),
    'bounce_rate_percent', round(v_bounce_rate, 2),
    'calculated_at', now()
  );
END;
$$;

-- Create trigger to update timestamps
CREATE OR REPLACE FUNCTION public.update_suppression_list_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_email_suppression_list_updated_at
  BEFORE UPDATE ON public.email_suppression_list
  FOR EACH ROW
  EXECUTE FUNCTION public.update_suppression_list_updated_at();

CREATE TRIGGER update_email_bounce_tracking_updated_at
  BEFORE UPDATE ON public.email_bounce_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_suppression_list_updated_at();

-- Insert default admin alert configuration if it doesn't exist
INSERT INTO public.communication_settings (
  setting_key, setting_value, description, is_active
) VALUES (
  'email_failure_alert_config',
  jsonb_build_object(
    'admin_email', 'admin@startersmallchops.com',
    'failure_threshold', 5,
    'time_window_hours', 1,
    'enabled', true
  ),
  'Configuration for email failure alerting system',
  true
) ON CONFLICT (setting_key) DO NOTHING;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.auto_suppress_bounced_email(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_email_delivery_metrics(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_email_delivery_metrics(integer) TO authenticated;