-- Email Integration Production Hardening
-- Fix schema mismatches and add security policies

-- 1. Create missing smtp_delivery_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.smtp_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id TEXT,
  recipient_email TEXT NOT NULL,
  sender_email TEXT,
  subject TEXT,
  template_key TEXT,
  email_type TEXT DEFAULT 'transactional',
  provider_used TEXT,
  delivery_status TEXT NOT NULL,
  delivery_attempt INTEGER DEFAULT 1,
  provider_response JSONB DEFAULT '{}',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add RLS policies for email security
ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_delivery_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppression_list ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage communication events" ON public.communication_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage delivery confirmations" ON public.smtp_delivery_confirmations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage delivery logs" ON public.smtp_delivery_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage suppression list" ON public.email_suppression_list
  FOR ALL USING (auth.role() = 'service_role');

-- Admin read access for monitoring
CREATE POLICY "Admins can read communication events" ON public.communication_events
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can read delivery logs" ON public.smtp_delivery_logs
  FOR SELECT USING (is_admin());

-- 3. Create secure RPC function for admin email queue processing
CREATE OR REPLACE FUNCTION public.admin_process_email_queue(
  batch_size INTEGER DEFAULT 50,
  priority_filter TEXT DEFAULT 'all'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  processed_count INTEGER := 0;
  result JSONB;
BEGIN
  -- Only allow admins or service role
  IF NOT (auth.role() = 'service_role' OR is_admin()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Call the email-core processor via HTTP
  SELECT content::jsonb INTO result
  FROM http((
    'POST',
    current_setting('app.supabase_url') || '/functions/v1/email-core',
    ARRAY[
      http_header('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
      http_header('Content-Type', 'application/json')
    ],
    jsonb_build_object(
      'action', 'process_queue',
      'batch_size', batch_size,
      'priority_filter', priority_filter
    )::text
  ));

  RETURN COALESCE(result, jsonb_build_object('error', 'No response from email processor'));

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'processed', 0
    );
END;
$$;

-- 4. Enhanced email suppression check function
CREATE OR REPLACE FUNCTION public.check_email_suppression_enhanced(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_suppressed BOOLEAN := false;
  v_reason TEXT := null;
  v_suppression_date TIMESTAMP WITH TIME ZONE := null;
BEGIN
  -- Check email_suppression_list
  SELECT is_active, suppression_type, created_at
  INTO v_suppressed, v_reason, v_suppression_date
  FROM email_suppression_list 
  WHERE email = LOWER(p_email) AND is_active = true
  LIMIT 1;
  
  IF v_suppressed THEN
    RETURN jsonb_build_object(
      'suppressed', true,
      'reason', v_reason,
      'suppressed_at', v_suppression_date,
      'source', 'suppression_list'
    );
  END IF;
  
  -- Check bounce tracking for hard bounces
  SELECT true, 'hard_bounce', suppressed_at
  INTO v_suppressed, v_reason, v_suppression_date
  FROM email_bounce_tracking 
  WHERE email_address = LOWER(p_email) 
    AND bounce_type = 'hard' 
    AND suppressed_at IS NOT NULL
  LIMIT 1;
  
  IF v_suppressed THEN
    RETURN jsonb_build_object(
      'suppressed', true,
      'reason', v_reason,
      'suppressed_at', v_suppression_date,
      'source', 'bounce_tracking'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'suppressed', false,
    'reason', null
  );
END;
$$;

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_communication_events_status_priority 
  ON public.communication_events(status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_communication_events_recipient_status 
  ON public.communication_events(recipient_email, status);

CREATE INDEX IF NOT EXISTS idx_smtp_delivery_logs_recipient_created 
  ON public.smtp_delivery_logs(recipient_email, created_at);

CREATE INDEX IF NOT EXISTS idx_email_suppression_active_email 
  ON public.email_suppression_list(email, is_active) WHERE is_active = true;

-- 6. Update triggers for automated timestamps
CREATE OR REPLACE FUNCTION update_smtp_delivery_logs_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply timestamp trigger to smtp_delivery_logs
DROP TRIGGER IF EXISTS trigger_update_smtp_delivery_logs_timestamp ON public.smtp_delivery_logs;
CREATE TRIGGER trigger_update_smtp_delivery_logs_timestamp
  BEFORE UPDATE ON public.smtp_delivery_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_smtp_delivery_logs_timestamp();

-- 7. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;