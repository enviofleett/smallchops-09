-- SMS Communication Channel Implementation
-- Phase 1: Database Schema Extensions for SMS Support

-- 1. Extend communication_events table to support SMS
ALTER TABLE public.communication_events 
ADD COLUMN IF NOT EXISTS recipient_phone TEXT,
ADD COLUMN IF NOT EXISTS sms_status TEXT,
ADD COLUMN IF NOT EXISTS sms_provider_message_id TEXT,
ADD COLUMN IF NOT EXISTS sms_provider_response JSONB,
ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'both')),
ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sms_delivery_status TEXT,
ADD COLUMN IF NOT EXISTS sms_error_message TEXT;

-- 2. Create SMS suppression list for opt-outs and blacklists
CREATE TABLE IF NOT EXISTS public.sms_suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL, -- 'opt_out', 'bounced', 'invalid', 'admin_blocked'
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. Create SMS delivery logs for tracking
CREATE TABLE IF NOT EXISTS public.sms_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_event_id UUID REFERENCES public.communication_events(id),
  phone_number TEXT NOT NULL,
  message_content TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL, -- 'sent', 'delivered', 'failed', 'bounced'
  provider_response JSONB,
  cost_amount DECIMAL(10,4), -- Track SMS costs
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  webhook_data JSONB
);

-- 4. Create SMS provider settings table
CREATE TABLE IF NOT EXISTS public.sms_provider_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL DEFAULT 'mysmstab',
  api_endpoint TEXT,
  sender_id TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB, -- Store provider-specific settings
  wallet_balance DECIMAL(10,2) DEFAULT 0,
  last_balance_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_communication_events_recipient_phone ON public.communication_events(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_communication_events_channel ON public.communication_events(channel);
CREATE INDEX IF NOT EXISTS idx_communication_events_sms_status ON public.communication_events(sms_status);
CREATE INDEX IF NOT EXISTS idx_sms_suppression_phone ON public.sms_suppression_list(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_phone ON public.sms_delivery_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_status ON public.sms_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_timestamp ON public.sms_delivery_logs(timestamp);

-- 6. Enable RLS on new SMS tables
ALTER TABLE public.sms_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_provider_settings ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for SMS tables
-- SMS suppression list policies
CREATE POLICY "Admins can manage SMS suppressions" 
ON public.sms_suppression_list 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Service roles can manage SMS suppressions" 
ON public.sms_suppression_list 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- SMS delivery logs policies
CREATE POLICY "Admins can view SMS delivery logs" 
ON public.sms_delivery_logs 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Service roles can manage SMS delivery logs" 
ON public.sms_delivery_logs 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- SMS provider settings policies
CREATE POLICY "Admins can manage SMS provider settings" 
ON public.sms_provider_settings 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Service roles can read SMS provider settings" 
ON public.sms_provider_settings 
FOR SELECT 
USING (auth.role() = 'service_role');

-- 8. Helper functions for SMS operations

-- Function to check if phone number is suppressed
CREATE OR REPLACE FUNCTION public.is_phone_suppressed(phone_number TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sms_suppression_list 
    WHERE phone_number = $1
  );
$$;

-- Function to add phone to suppression list
CREATE OR REPLACE FUNCTION public.suppress_phone_number(
  phone_number TEXT,
  reason TEXT DEFAULT 'opt_out',
  event_data JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  suppression_id UUID;
BEGIN
  INSERT INTO public.sms_suppression_list (phone_number, reason, event_data, created_by)
  VALUES ($1, $2, $3, auth.uid())
  ON CONFLICT (phone_number) DO UPDATE SET
    reason = EXCLUDED.reason,
    event_data = EXCLUDED.event_data,
    created_at = NOW()
  RETURNING id INTO suppression_id;
  
  RETURN suppression_id;
END;
$$;

-- Function to log SMS security events
CREATE OR REPLACE FUNCTION public.log_sms_security_event(
  p_event_type TEXT,
  p_phone_number TEXT,
  p_function_name TEXT,
  p_details JSONB DEFAULT '{}'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    new_values
  ) VALUES (
    p_event_type,
    'SMS Security',
    format('SMS security event in %s: %s', p_function_name, p_phone_number),
    auth.uid(),
    p_details
  );
END;
$$;

-- 9. Update communication_events to handle SMS event types
-- Add comment to document new SMS event types
COMMENT ON COLUMN public.communication_events.event_type IS 'The type of event that triggered this communication. Email types: order_status_update, payment_confirmation, welcome_email, etc. SMS types: order_status_sms, payment_confirmation_sms, welcome_sms, etc.';

-- 10. Insert default SMS provider settings
INSERT INTO public.sms_provider_settings (provider_name, api_endpoint, sender_id, settings)
VALUES (
  'mysmstab',
  'https://api.mysmstab.com/v1/sms/send',
  'Starters',
  jsonb_build_object(
    'max_retries', 3,
    'retry_delay_seconds', 60,
    'rate_limit_per_minute', 60,
    'webhook_enabled', true
  )
) ON CONFLICT DO NOTHING;