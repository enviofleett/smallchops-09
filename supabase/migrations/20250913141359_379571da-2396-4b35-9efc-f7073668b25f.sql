-- Update sms_provider_settings table for MySMSTab integration
-- Add missing columns for proper MySMSTab API integration
ALTER TABLE public.sms_provider_settings 
ADD COLUMN IF NOT EXISTS api_url TEXT DEFAULT 'https://sms.mysmstab.com/api/';

-- Rename existing columns to match MySMSTab API requirements
ALTER TABLE public.sms_provider_settings 
RENAME COLUMN username TO api_username;

ALTER TABLE public.sms_provider_settings 
RENAME COLUMN password TO api_password;

-- Update existing MySMSTab provider or insert new one
INSERT INTO public.sms_provider_settings (
  provider_name,
  api_url,
  api_username,
  api_password,
  default_sender,
  is_active,
  created_at,
  updated_at
) VALUES (
  'MySMSTab',
  'https://sms.mysmstab.com/api/',
  NULL, -- Will be set by admin
  NULL, -- Will be set by admin
  'MySMSTab',
  false, -- Inactive until credentials are set
  NOW(),
  NOW()
) ON CONFLICT (provider_name) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  updated_at = NOW();

-- Create function to check MySMSTab balance
CREATE OR REPLACE FUNCTION public.check_mysmstab_balance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  provider_settings RECORD;
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied - admin required'
    );
  END IF;
  
  -- Get MySMSTab provider settings
  SELECT * INTO provider_settings
  FROM sms_provider_settings
  WHERE provider_name = 'MySMSTab'
    AND is_active = true
    AND api_username IS NOT NULL
    AND api_password IS NOT NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MySMSTab provider not configured or inactive'
    );
  END IF;
  
  -- Log the balance check request
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id
  ) VALUES (
    'sms_balance_check',
    'SMS System',
    'Admin requested MySMSTab balance check',
    auth.uid()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Balance check initiated',
    'provider_url', provider_settings.api_url,
    'next_steps', 'Check the mysmstab-sms edge function logs for balance results'
  );
END;
$$;