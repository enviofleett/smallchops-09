-- Email Integration Production Hardening (Corrected)
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

-- 2. Fix email_suppression_list schema to match usage
ALTER TABLE public.email_suppression_list 
ADD COLUMN IF NOT EXISTS suppression_type TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing records to have is_active = true
UPDATE public.email_suppression_list SET is_active = true WHERE is_active IS NULL;

-- 3. Add RLS policies for email security
ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_delivery_confirmations ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.smtp_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppression_list ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Service role can manage communication events" ON public.communication_events;
DROP POLICY IF EXISTS "Service role can manage delivery confirmations" ON public.smtp_delivery_confirmations;
DROP POLICY IF EXISTS "Service role can manage delivery logs" ON public.smtp_delivery_logs;
DROP POLICY IF EXISTS "Service role can manage suppression list" ON public.email_suppression_list;
DROP POLICY IF EXISTS "Admins can read communication events" ON public.communication_events;
DROP POLICY IF EXISTS "Admins can read delivery logs" ON public.smtp_delivery_logs;

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

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_communication_events_status_priority 
  ON public.communication_events(status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_communication_events_recipient_status 
  ON public.communication_events(recipient_email, status);

CREATE INDEX IF NOT EXISTS idx_smtp_delivery_logs_recipient_created 
  ON public.smtp_delivery_logs(recipient_email, created_at);

CREATE INDEX IF NOT EXISTS idx_email_suppression_active_email 
  ON public.email_suppression_list(email_address, is_active) WHERE is_active = true;

-- 5. Update timestamp trigger for smtp_delivery_logs
CREATE OR REPLACE FUNCTION update_smtp_delivery_logs_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_smtp_delivery_logs_timestamp ON public.smtp_delivery_logs;
CREATE TRIGGER trigger_update_smtp_delivery_logs_timestamp
  BEFORE UPDATE ON public.smtp_delivery_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_smtp_delivery_logs_timestamp();