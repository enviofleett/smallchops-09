-- Production Email System Fixes Migration
-- This migration fixes critical security issues and consolidates the email system

-- Fix security definer functions that lack proper search path
-- These functions need SET search_path = 'public' for security

ALTER FUNCTION public.is_admin() SET search_path = 'public';
ALTER FUNCTION public.validate_admin_access() SET search_path = 'public'; 
ALTER FUNCTION public.is_admin_secure() SET search_path = 'public';
ALTER FUNCTION public.check_otp_rate_limit(text) SET search_path = 'public';
ALTER FUNCTION public.check_otp_rate_limit_secure(text) SET search_path = 'public';
ALTER FUNCTION public.verify_customer_otp(text, text, text, text) SET search_path = 'public';
ALTER FUNCTION public.create_customer_account_secure(text, text, text, text) SET search_path = 'public';
ALTER FUNCTION public.handle_successful_payment(text, text, numeric, text, jsonb) SET search_path = 'public';
ALTER FUNCTION public.get_orders_with_payment(uuid, text) SET search_path = 'public';
ALTER FUNCTION public.log_security_event(text, text, text, uuid, inet, text, jsonb) SET search_path = 'public';
ALTER FUNCTION public.log_api_request(text, text, inet, text, jsonb, integer, integer, uuid, text, jsonb) SET search_path = 'public';

-- Create standardized email delivery logging table
CREATE TABLE IF NOT EXISTS public.email_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text UNIQUE NOT NULL,
  recipient_email text NOT NULL,
  sender_email text,
  subject text NOT NULL,
  template_key text,
  email_type text DEFAULT 'transactional',
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  error_message text,
  smtp_response text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  variables jsonb DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for email delivery logs
ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email delivery logs
CREATE POLICY "Admins can manage email delivery logs" 
  ON public.email_delivery_logs 
  FOR ALL USING (is_admin()) 
  WITH CHECK (is_admin());

CREATE POLICY "Service roles can manage email delivery logs" 
  ON public.email_delivery_logs 
  FOR ALL USING (auth.role() = 'service_role') 
  WITH CHECK (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_recipient ON public.email_delivery_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status ON public.email_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_provider ON public.email_delivery_logs(provider);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_created_at ON public.email_delivery_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_template_key ON public.email_delivery_logs(template_key);

-- Create email configuration table for production settings
CREATE TABLE IF NOT EXISTS public.email_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL,
  provider_type text NOT NULL CHECK (provider_type IN ('smtp', 'api', 'supabase_auth')),
  host text,
  port integer,
  username text,
  password_encrypted text,
  use_tls boolean DEFAULT true,
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  max_daily_limit integer DEFAULT 1000,
  current_daily_count integer DEFAULT 0,
  last_reset_date date DEFAULT CURRENT_DATE,
  health_score numeric(3,2) DEFAULT 100.00,
  last_error text,
  last_success_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_name)
);

-- Enable RLS for email config
ALTER TABLE public.email_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email config
CREATE POLICY "Admins can manage email config" 
  ON public.email_config 
  FOR ALL USING (is_admin()) 
  WITH CHECK (is_admin());

-- Create function to get active email provider
CREATE OR REPLACE FUNCTION public.get_active_email_provider()
RETURNS TABLE (
  provider_name text,
  provider_type text,
  host text,
  port integer,
  username text,
  use_tls boolean,
  health_score numeric
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    ec.provider_name,
    ec.provider_type,
    ec.host,
    ec.port,
    ec.username,
    ec.use_tls,
    ec.health_score
  FROM email_config ec
  WHERE ec.is_active = true 
    AND ec.is_primary = true
    AND ec.health_score > 50
  ORDER BY ec.health_score DESC, ec.last_success_at DESC NULLS LAST
  LIMIT 1;
$$;

-- Create function to log email delivery
CREATE OR REPLACE FUNCTION public.log_email_delivery(
  p_message_id text,
  p_recipient_email text,
  p_subject text,
  p_provider text,
  p_status text DEFAULT 'queued',
  p_template_key text DEFAULT NULL,
  p_variables jsonb DEFAULT '{}',
  p_smtp_response text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO email_delivery_logs (
    message_id,
    recipient_email,
    subject,
    provider,
    status,
    template_key,
    variables,
    smtp_response,
    sent_at
  ) VALUES (
    p_message_id,
    p_recipient_email,
    p_subject,
    p_provider,
    p_status,
    p_template_key,
    p_variables,
    p_smtp_response,
    CASE WHEN p_status = 'sent' THEN now() ELSE NULL END
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Create function to update email status
CREATE OR REPLACE FUNCTION public.update_email_status(
  p_message_id text,
  p_status text,
  p_error_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE email_delivery_logs
  SET 
    status = p_status,
    error_message = p_error_message,
    delivered_at = CASE WHEN p_status = 'delivered' THEN now() ELSE delivered_at END,
    bounced_at = CASE WHEN p_status = 'bounced' THEN now() ELSE bounced_at END,
    updated_at = now()
  WHERE message_id = p_message_id;
  
  RETURN FOUND;
END;
$$;

-- Create function to check email rate limits
CREATE OR REPLACE FUNCTION public.check_email_rate_limit(p_recipient_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_hourly_count integer;
  v_daily_count integer;
  v_hourly_limit integer := 10;
  v_daily_limit integer := 50;
BEGIN
  -- Check hourly limit
  SELECT COUNT(*) INTO v_hourly_count
  FROM email_delivery_logs
  WHERE recipient_email = p_recipient_email
    AND created_at > now() - interval '1 hour';
    
  -- Check daily limit  
  SELECT COUNT(*) INTO v_daily_count
  FROM email_delivery_logs
  WHERE recipient_email = p_recipient_email
    AND created_at > now() - interval '24 hours';
    
  IF v_hourly_count >= v_hourly_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'hourly_limit_exceeded',
      'limit', v_hourly_limit,
      'count', v_hourly_count
    );
  END IF;
  
  IF v_daily_count >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_exceeded', 
      'limit', v_daily_limit,
      'count', v_daily_count
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'hourly_remaining', v_hourly_limit - v_hourly_count,
    'daily_remaining', v_daily_limit - v_daily_count
  );
END;
$$;

-- Insert default SMTP configuration if none exists
INSERT INTO public.email_config (
  provider_name,
  provider_type,
  host,
  port,
  use_tls,
  is_primary,
  is_active,
  health_score
) VALUES (
  'production_smtp',
  'smtp',
  'mail.startersmallchops.com',
  587,
  true,
  true,
  true,
  100.00
) ON CONFLICT (provider_name) DO NOTHING;

-- Clean up any orphaned data from conflicting tables
-- Remove references to non-existent smtp_provider_configs table
UPDATE communication_settings 
SET email_templates = email_templates - 'smtp_provider_id'
WHERE email_templates ? 'smtp_provider_id';

-- Add trigger to update email_delivery_logs timestamp
CREATE OR REPLACE FUNCTION public.update_email_delivery_logs_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_delivery_logs_updated_at
    BEFORE UPDATE ON public.email_delivery_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_email_delivery_logs_updated_at();