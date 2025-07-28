-- Phase 1: Critical email infrastructure database setup

-- Email delivery tracking table
CREATE TABLE IF NOT EXISTS public.email_delivery_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id TEXT,
  event_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL,
  timestamp TIMESTAMPTZ,
  webhook_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email suppression list for bounces and unsubscribes
CREATE TABLE IF NOT EXISTS public.email_suppression_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_address TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email consent tracking for GDPR compliance
CREATE TABLE IF NOT EXISTS public.email_consents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_address TEXT NOT NULL,
  consent_type TEXT NOT NULL DEFAULT 'marketing',
  consent_source TEXT,
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced communication events table
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS recipient_email TEXT;
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS email_type TEXT DEFAULT 'transactional';
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS variables JSONB;
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS delivery_status TEXT;
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_email_id ON public.email_delivery_logs(email_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_recipient ON public.email_delivery_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_timestamp ON public.email_delivery_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_email_suppression_email ON public.email_suppression_list(email_address);
CREATE INDEX IF NOT EXISTS idx_email_consents_email ON public.email_consents(email_address);
CREATE INDEX IF NOT EXISTS idx_email_consents_active ON public.email_consents(email_address, is_active);
CREATE INDEX IF NOT EXISTS idx_communication_events_recipient ON public.communication_events(recipient_email);
CREATE INDEX IF NOT EXISTS idx_communication_events_external_id ON public.communication_events(external_id);

-- Enable RLS on new tables
ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_consents ENABLE ROW LEVEL SECURITY;

-- RLS policies for email delivery logs
CREATE POLICY "Admins can view all email delivery logs" ON public.email_delivery_logs
  FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can manage email delivery logs" ON public.email_delivery_logs
  FOR ALL USING (auth.role() = 'service_role');

-- RLS policies for email suppression list
CREATE POLICY "Admins can view suppression list" ON public.email_suppression_list
  FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can manage suppression list" ON public.email_suppression_list
  FOR ALL USING (auth.role() = 'service_role');

-- RLS policies for email consents
CREATE POLICY "Admins can view all consents" ON public.email_consents
  FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can manage consents" ON public.email_consents
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own consents" ON public.email_consents
  FOR SELECT USING (
    email_address = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Function to check email suppression
CREATE OR REPLACE FUNCTION public.is_email_suppressed(email_address TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.email_suppression_list 
    WHERE email_address = $1
  );
$$;

-- Function to check email consent
CREATE OR REPLACE FUNCTION public.has_email_consent(email_address TEXT, consent_type TEXT DEFAULT 'marketing')
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.email_consents 
    WHERE email_address = $1 
    AND consent_type = $2 
    AND is_active = true
  );
$$;