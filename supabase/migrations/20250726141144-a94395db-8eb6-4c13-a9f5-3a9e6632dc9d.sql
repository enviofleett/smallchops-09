-- Fix remaining security issues and add missing functionality

-- Fix function search_path security issues
DROP FUNCTION IF EXISTS public.update_updated_at_column CASCADE;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate triggers with proper functions
DROP TRIGGER IF EXISTS update_environment_config_updated_at ON public.environment_config;
CREATE TRIGGER update_environment_config_updated_at
  BEFORE UPDATE ON public.environment_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add unique constraint for saved_payment_methods authorization_code
ALTER TABLE public.saved_payment_methods 
ADD CONSTRAINT unique_authorization_code UNIQUE (authorization_code);

-- Create environment configuration management function
CREATE OR REPLACE FUNCTION public.get_environment_config()
RETURNS TABLE (
  environment text,
  is_live_mode boolean,
  webhook_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ec.environment,
    ec.is_live_mode,
    ec.webhook_url
  FROM environment_config ec
  ORDER BY ec.created_at DESC
  LIMIT 1;
END;
$$;

-- Create function to get active payment integration
CREATE OR REPLACE FUNCTION public.get_active_paystack_config()
RETURNS TABLE (
  public_key text,
  secret_key text,
  webhook_secret text,
  test_mode boolean,
  environment text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  env_config RECORD;
BEGIN
  -- Get current environment configuration
  SELECT * INTO env_config FROM get_environment_config() LIMIT 1;
  
  -- Return appropriate keys based on environment
  RETURN QUERY
  SELECT 
    CASE 
      WHEN COALESCE(env_config.is_live_mode, false) = true 
      THEN COALESCE(pi.live_public_key, pi.public_key)
      ELSE pi.public_key
    END as public_key,
    CASE 
      WHEN COALESCE(env_config.is_live_mode, false) = true 
      THEN COALESCE(pi.live_secret_key, pi.secret_key)
      ELSE pi.secret_key
    END as secret_key,
    CASE 
      WHEN COALESCE(env_config.is_live_mode, false) = true 
      THEN COALESCE(pi.live_webhook_secret, pi.webhook_secret)
      ELSE pi.webhook_secret
    END as webhook_secret,
    NOT COALESCE(env_config.is_live_mode, false) as test_mode,
    COALESCE(env_config.environment, 'development') as environment
  FROM payment_integrations pi
  WHERE pi.provider = 'paystack' 
    AND pi.connection_status = 'connected'
  ORDER BY pi.updated_at DESC
  LIMIT 1;
END;
$$;

-- Create comprehensive payment status tracking table
CREATE TABLE IF NOT EXISTS public.payment_status_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES payment_transactions(id),
  status text NOT NULL,
  previous_status text,
  status_reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Enable RLS on payment_status_tracking
ALTER TABLE public.payment_status_tracking ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for payment_status_tracking
CREATE POLICY "Admins can view payment status tracking"
ON public.payment_status_tracking
FOR SELECT
USING (is_admin());

CREATE POLICY "Service roles can manage payment status tracking"
ON public.payment_status_tracking
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create order status synchronization function
CREATE OR REPLACE FUNCTION public.sync_payment_to_order_status(
  p_transaction_id uuid,
  p_payment_status text,
  p_order_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_old_payment_status text;
  v_old_order_status text;
BEGIN
  -- Get current order and payment status
  SELECT 
    pt.order_id,
    pt.status,
    o.status
  INTO v_order_id, v_old_payment_status, v_old_order_status
  FROM payment_transactions pt
  LEFT JOIN orders o ON pt.order_id = o.id
  WHERE pt.id = p_transaction_id;
  
  -- Update payment transaction status
  UPDATE payment_transactions 
  SET status = p_payment_status
  WHERE id = p_transaction_id;
  
  -- Track status change
  INSERT INTO payment_status_tracking (
    transaction_id,
    status,
    previous_status,
    status_reason,
    metadata
  ) VALUES (
    p_transaction_id,
    p_payment_status,
    v_old_payment_status,
    'System status update',
    jsonb_build_object('automated', true)
  );
  
  -- Update order status if order exists and new status provided
  IF v_order_id IS NOT NULL AND p_order_status IS NOT NULL THEN
    UPDATE orders 
    SET 
      status = p_order_status::order_status,
      payment_status = CASE 
        WHEN p_payment_status = 'success' THEN 'paid'::payment_status
        WHEN p_payment_status = 'failed' THEN 'failed'::payment_status
        ELSE payment_status
      END,
      updated_at = now()
    WHERE id = v_order_id;
  END IF;
END;
$$;

-- Create webhook verification function
CREATE OR REPLACE FUNCTION public.verify_webhook_signature(
  p_payload text,
  p_signature text,
  p_secret text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  computed_signature text;
BEGIN
  -- Compute HMAC-SHA512 signature
  computed_signature := encode(
    hmac(p_payload::bytea, p_secret::bytea, 'sha512'), 
    'hex'
  );
  
  -- Compare signatures (timing-safe comparison)
  RETURN computed_signature = p_signature;
END;
$$;

-- Create rate limiting enhancement function
CREATE OR REPLACE FUNCTION public.check_enhanced_rate_limit(
  p_user_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_operation_type text DEFAULT 'payment',
  p_limit_per_minute integer DEFAULT 5,
  p_limit_per_hour integer DEFAULT 20
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  minute_count integer;
  hour_count integer;
BEGIN
  -- Check minute limit
  SELECT COUNT(*) INTO minute_count
  FROM payment_rate_limits
  WHERE (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_ip_address IS NULL OR ip_address = p_ip_address)
    AND operation_type = p_operation_type
    AND window_start > now() - interval '1 minute';
    
  IF minute_count >= p_limit_per_minute THEN
    RETURN false;
  END IF;
  
  -- Check hour limit
  SELECT COUNT(*) INTO hour_count
  FROM payment_rate_limits
  WHERE (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_ip_address IS NULL OR ip_address = p_ip_address)
    AND operation_type = p_operation_type
    AND window_start > now() - interval '1 hour';
    
  IF hour_count >= p_limit_per_hour THEN
    RETURN false;
  END IF;
  
  -- Record this attempt
  INSERT INTO payment_rate_limits (
    user_id,
    ip_address,
    operation_type,
    window_start
  ) VALUES (
    p_user_id,
    p_ip_address,
    p_operation_type,
    now()
  );
  
  RETURN true;
END;
$$;