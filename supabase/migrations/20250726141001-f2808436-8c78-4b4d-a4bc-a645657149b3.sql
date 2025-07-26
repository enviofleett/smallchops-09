-- Fix database security issues and enhance payment system

-- Drop existing functions to recreate with proper security
DROP FUNCTION IF EXISTS public.handle_successful_payment CASCADE;

-- Recreate handle_successful_payment with proper security
CREATE OR REPLACE FUNCTION public.handle_successful_payment(
  p_reference text, 
  p_paid_at timestamp with time zone, 
  p_gateway_response text, 
  p_fees numeric, 
  p_channel text, 
  p_authorization_code text DEFAULT NULL::text, 
  p_card_type text DEFAULT NULL::text, 
  p_last4 text DEFAULT NULL::text, 
  p_exp_month text DEFAULT NULL::text, 
  p_exp_year text DEFAULT NULL::text, 
  p_bank text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_transaction_id uuid;
  v_order_id uuid;
  v_user_id uuid;
BEGIN
  -- Update payment transaction atomically
  UPDATE payment_transactions 
  SET 
    status = 'success',
    paid_at = p_paid_at,
    gateway_response = p_gateway_response,
    fees = p_fees,
    channel = p_channel,
    authorization_code = p_authorization_code,
    card_type = p_card_type,
    last4 = p_last4,
    exp_month = p_exp_month,
    exp_year = p_exp_year,
    bank = p_bank,
    processed_at = now()
  WHERE provider_reference = p_reference
  RETURNING id, order_id, (metadata->>'user_id')::uuid INTO v_transaction_id, v_order_id, v_user_id;

  -- If no transaction found, raise exception
  IF v_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Transaction with reference % not found', p_reference;
  END IF;

  -- Update order status if order exists
  IF v_order_id IS NOT NULL THEN
    UPDATE orders 
    SET 
      payment_status = 'paid',
      status = 'confirmed',
      updated_at = now()
    WHERE id = v_order_id;
  END IF;

  -- Save payment method if authorization provided and user exists
  IF p_authorization_code IS NOT NULL AND v_user_id IS NOT NULL THEN
    INSERT INTO saved_payment_methods (
      user_id,
      provider,
      authorization_code,
      card_type,
      last4,
      exp_month,
      exp_year,
      bank,
      is_active
    ) VALUES (
      v_user_id,
      'paystack',
      p_authorization_code,
      p_card_type,
      p_last4,
      p_exp_month,
      p_exp_year,
      p_bank,
      true
    ) ON CONFLICT (authorization_code) DO UPDATE SET
      is_active = true,
      updated_at = now();
  END IF;
END;
$function$;

-- Create environment configuration table
CREATE TABLE IF NOT EXISTS public.environment_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL DEFAULT 'development',
  is_live_mode boolean NOT NULL DEFAULT false,
  paystack_live_public_key text,
  paystack_live_secret_key text,
  paystack_test_public_key text,
  paystack_test_secret_key text,
  webhook_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on environment_config
ALTER TABLE public.environment_config ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for environment_config
CREATE POLICY "Admins can manage environment config"
ON public.environment_config
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Create payment error tracking table
CREATE TABLE IF NOT EXISTS public.payment_error_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_code text NOT NULL,
  error_message text NOT NULL,
  error_context jsonb DEFAULT '{}',
  user_id uuid,
  order_id uuid,
  transaction_reference text,
  severity text NOT NULL DEFAULT 'medium',
  resolved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  resolution_notes text
);

-- Enable RLS on payment_error_tracking
ALTER TABLE public.payment_error_tracking ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for payment_error_tracking
CREATE POLICY "Admins can view all payment errors"
ON public.payment_error_tracking
FOR SELECT
USING (is_admin());

CREATE POLICY "Service roles can manage payment errors"
ON public.payment_error_tracking
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create payment health metrics table
CREATE TABLE IF NOT EXISTS public.payment_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  metric_unit text DEFAULT 'count',
  recorded_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

-- Enable RLS on payment_health_metrics
ALTER TABLE public.payment_health_metrics ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for payment_health_metrics
CREATE POLICY "Admins can view payment health metrics"
ON public.payment_health_metrics
FOR SELECT
USING (is_admin());

CREATE POLICY "Service roles can manage payment health metrics"
ON public.payment_health_metrics
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create function to log payment errors
CREATE OR REPLACE FUNCTION public.log_payment_error(
  p_error_code text,
  p_error_message text,
  p_error_context jsonb DEFAULT '{}',
  p_user_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_transaction_reference text DEFAULT NULL,
  p_severity text DEFAULT 'medium'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_error_id uuid;
BEGIN
  INSERT INTO payment_error_tracking (
    error_code,
    error_message,
    error_context,
    user_id,
    order_id,
    transaction_reference,
    severity
  ) VALUES (
    p_error_code,
    p_error_message,
    p_error_context,
    p_user_id,
    p_order_id,
    p_transaction_reference,
    p_severity
  ) RETURNING id INTO v_error_id;
  
  RETURN v_error_id;
END;
$function$;

-- Create function to record payment health metrics
CREATE OR REPLACE FUNCTION public.record_payment_metric(
  p_metric_name text,
  p_metric_value numeric,
  p_metric_unit text DEFAULT 'count',
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO payment_health_metrics (
    metric_name,
    metric_value,
    metric_unit,
    metadata
  ) VALUES (
    p_metric_name,
    p_metric_value,
    p_metric_unit,
    p_metadata
  );
END;
$function$;

-- Update payment_integrations table to support environment switching
ALTER TABLE public.payment_integrations 
ADD COLUMN IF NOT EXISTS environment text DEFAULT 'test',
ADD COLUMN IF NOT EXISTS live_public_key text,
ADD COLUMN IF NOT EXISTS live_secret_key text,
ADD COLUMN IF NOT EXISTS live_webhook_secret text;

-- Create updated timestamp triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_environment_config_updated_at ON public.environment_config;
CREATE TRIGGER update_environment_config_updated_at
  BEFORE UPDATE ON public.environment_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default environment configuration
INSERT INTO public.environment_config (environment, is_live_mode)
VALUES ('development', false)
ON CONFLICT DO NOTHING;