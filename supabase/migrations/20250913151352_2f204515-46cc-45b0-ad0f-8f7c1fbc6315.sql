-- Check if sms_provider_settings table exists and create/update it
DO $$ 
BEGIN
  -- Drop table if it exists to recreate with correct structure
  DROP TABLE IF EXISTS public.sms_provider_settings CASCADE;
  
  -- Create sms_provider_settings table with correct columns
  CREATE TABLE public.sms_provider_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name TEXT NOT NULL,
    api_username TEXT,
    api_password TEXT,
    api_url TEXT DEFAULT 'https://app.mysmstab.com/api/',
    default_sender TEXT DEFAULT 'MySMSTab',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Ensure only one active provider per type
    CONSTRAINT unique_active_provider UNIQUE (provider_name)
  );

  -- Enable RLS
  ALTER TABLE public.sms_provider_settings ENABLE ROW LEVEL SECURITY;

  -- Create RLS policies
  CREATE POLICY "Admins can manage SMS provider settings"
    ON public.sms_provider_settings
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

  CREATE POLICY "Service roles can read SMS provider settings"
    ON public.sms_provider_settings
    FOR SELECT
    USING (auth.role() = 'service_role');

  -- Insert default MySMSTab provider configuration
  INSERT INTO public.sms_provider_settings (
    provider_name,
    api_url,
    default_sender,
    is_active
  ) VALUES (
    'MySMSTab',
    'https://app.mysmstab.com/api/',
    'MySMSTab',
    false
  ) ON CONFLICT (provider_name) DO NOTHING;

  -- Create update trigger
  CREATE OR REPLACE FUNCTION update_sms_provider_settings_updated_at()
  RETURNS TRIGGER AS $func$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $func$ LANGUAGE plpgsql;

  CREATE TRIGGER update_sms_provider_settings_updated_at
    BEFORE UPDATE ON public.sms_provider_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_sms_provider_settings_updated_at();

END $$;