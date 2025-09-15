-- Create paystack_secure_config table for payment configuration
CREATE TABLE IF NOT EXISTS public.paystack_secure_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT true,
  test_mode BOOLEAN NOT NULL DEFAULT true,
  test_public_key TEXT,
  test_secret_key TEXT,
  live_public_key TEXT,
  live_secret_key TEXT,
  webhook_secret TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create index for active configuration
CREATE INDEX IF NOT EXISTS idx_paystack_config_active ON public.paystack_secure_config(is_active, test_mode);

-- Enable RLS
ALTER TABLE public.paystack_secure_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for paystack configuration (admin only)
CREATE POLICY "paystack_config_admin_access" ON public.paystack_secure_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin' 
      AND is_active = true
    )
  );

-- Create function to get public paystack config safely
CREATE OR REPLACE FUNCTION public.get_public_paystack_config()
RETURNS TABLE(
  public_key TEXT,
  test_mode BOOLEAN,
  is_valid BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN psc.test_mode THEN psc.test_public_key 
      ELSE psc.live_public_key 
    END as public_key,
    psc.test_mode,
    CASE 
      WHEN psc.test_mode THEN (psc.test_public_key IS NOT NULL AND psc.test_secret_key IS NOT NULL)
      ELSE (psc.live_public_key IS NOT NULL AND psc.live_secret_key IS NOT NULL)
    END as is_valid
  FROM public.paystack_secure_config psc
  WHERE psc.is_active = true
  ORDER BY psc.updated_at DESC
  LIMIT 1;
END;
$$;

-- Insert default test configuration
INSERT INTO public.paystack_secure_config (
  test_mode,
  is_active,
  created_at,
  updated_at
) VALUES (
  true,
  true,
  now(),
  now()
) ON CONFLICT DO NOTHING;

-- Add audit logging for payment configuration changes
CREATE OR REPLACE FUNCTION public.log_paystack_config_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      action,
      category,
      message,
      user_id,
      entity_id,
      old_values,
      new_values
    ) VALUES (
      'paystack_config_updated',
      'Payment Security',
      'Paystack configuration updated',
      auth.uid(),
      NEW.id,
      jsonb_build_object(
        'test_mode', OLD.test_mode,
        'is_active', OLD.is_active
      ),
      jsonb_build_object(
        'test_mode', NEW.test_mode,
        'is_active', NEW.is_active
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for paystack config changes
DROP TRIGGER IF EXISTS paystack_config_audit_trigger ON public.paystack_secure_config;
CREATE TRIGGER paystack_config_audit_trigger
  AFTER UPDATE ON public.paystack_secure_config
  FOR EACH ROW
  EXECUTE FUNCTION public.log_paystack_config_changes();