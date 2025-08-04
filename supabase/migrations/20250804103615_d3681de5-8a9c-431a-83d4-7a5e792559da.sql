-- Phase 1A: Fix Function Search Path Security Vulnerabilities
-- Add SET search_path to all security definer functions for security

-- Fix verify_payment_atomic function
CREATE OR REPLACE FUNCTION public.verify_payment_atomic(p_reference text, p_paystack_data jsonb, p_verified_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_payment_record RECORD;
  v_paystack_amount INTEGER;
  v_expected_amount INTEGER;
  v_result JSONB;
BEGIN
  -- Start atomic transaction
  BEGIN
    -- Get payment record with order details
    SELECT p.*, o.total_amount as order_total
    INTO v_payment_record
    FROM payment_transactions p
    LEFT JOIN orders o ON p.order_id = o.id
    WHERE p.provider_reference = p_reference;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment with reference % not found', p_reference;
    END IF;

    -- Extract amount from Paystack data (in kobo)
    v_paystack_amount := (p_paystack_data->>'amount')::INTEGER;
    v_expected_amount := ROUND(v_payment_record.amount * 100); -- Convert to kobo

    -- Verify amount matches
    IF v_paystack_amount != v_expected_amount THEN
      -- Log security incident
      INSERT INTO public.security_incidents (
        type,
        description,
        severity,
        reference,
        expected_amount,
        received_amount,
        request_data
      ) VALUES (
        'amount_mismatch',
        'Payment amount mismatch detected during verification',
        'critical',
        p_reference,
        v_expected_amount,
        v_paystack_amount,
        p_paystack_data
      );
      
      RAISE EXCEPTION 'Payment amount mismatch: expected %, received %', v_expected_amount, v_paystack_amount;
    END IF;

    -- Update payment status
    UPDATE payment_transactions 
    SET 
      status = 'success',
      provider_response = p_paystack_data,
      paid_at = p_verified_at,
      processed_at = NOW(),
      updated_at = NOW()
    WHERE provider_reference = p_reference;

    -- Update related order status if exists
    IF v_payment_record.order_id IS NOT NULL THEN
      UPDATE orders 
      SET 
        payment_status = 'paid',
        status = 'confirmed',
        updated_at = NOW()
      WHERE id = v_payment_record.order_id;

      -- Update inventory atomically (only if products table exists with stock_quantity)
      UPDATE products 
      SET 
        stock_quantity = GREATEST(0, stock_quantity - oi.quantity),
        updated_at = NOW()
      FROM order_items oi
      WHERE oi.order_id = v_payment_record.order_id 
        AND products.id = oi.product_id
        AND EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' 
                   AND column_name = 'stock_quantity');
    END IF;

    -- Log successful verification
    INSERT INTO public.payment_audit_log (
      payment_reference,
      action,
      previous_status,
      new_status,
      metadata
    ) VALUES (
      p_reference,
      'verify_payment_atomic',
      'pending',
      'verified',
      jsonb_build_object(
        'paystack_amount', v_paystack_amount,
        'expected_amount', v_expected_amount,
        'order_id', v_payment_record.order_id
      )
    );

    v_result := jsonb_build_object(
      'success', true,
      'payment_id', v_payment_record.id,
      'order_id', v_payment_record.order_id,
      'amount', v_payment_record.amount,
      'verified_at', p_verified_at
    );

    RETURN v_result;

  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error
      INSERT INTO public.security_incidents (
        type,
        description,
        severity,
        reference,
        error_message,
        request_data
      ) VALUES (
        'payment_verification_error',
        'Error during atomic payment verification',
        'high',
        p_reference,
        SQLERRM,
        p_paystack_data
      );
      
      RAISE;
  END;
END;
$function$;

-- Fix confirm_payment_atomic function
CREATE OR REPLACE FUNCTION public.confirm_payment_atomic(p_reference text, p_amount integer, p_paystack_data jsonb, p_confirmed_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_transaction_record RECORD;
  v_expected_amount INTEGER;
  v_result JSONB;
BEGIN
  BEGIN
    -- Get payment transaction details
    SELECT pt.*, o.total_amount as order_total
    INTO v_transaction_record
    FROM payment_transactions pt
    LEFT JOIN orders o ON pt.order_id = o.id
    WHERE pt.provider_reference = p_reference;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transaction with reference % not found', p_reference;
    END IF;

    -- Calculate expected amount in kobo
    v_expected_amount := ROUND(v_transaction_record.amount * 100);

    -- Verify amount matches
    IF v_expected_amount != p_amount THEN
      -- Log security incident
      INSERT INTO public.security_incidents (
        type,
        description,
        severity,
        reference,
        expected_amount,
        received_amount,
        request_data
      ) VALUES (
        'webhook_amount_mismatch',
        'Webhook amount mismatch detected',
        'critical',
        p_reference,
        v_expected_amount,
        p_amount,
        p_paystack_data
      );
      
      RAISE EXCEPTION 'Amount mismatch: expected %, received %', v_expected_amount, p_amount;
    END IF;

    -- Update payment transaction
    UPDATE payment_transactions 
    SET 
      status = 'success',
      provider_response = p_paystack_data,
      paid_at = p_confirmed_at,
      processed_at = NOW(),
      updated_at = NOW()
    WHERE provider_reference = p_reference;

    -- Update order if exists
    IF v_transaction_record.order_id IS NOT NULL THEN
      UPDATE orders 
      SET 
        payment_status = 'paid',
        status = 'processing',
        updated_at = NOW()
      WHERE id = v_transaction_record.order_id;
    END IF;

    -- Log confirmation
    INSERT INTO public.payment_audit_log (
      payment_reference,
      action,
      previous_status,
      new_status,
      metadata
    ) VALUES (
      p_reference,
      'confirm_payment_webhook',
      v_transaction_record.status,
      'success',
      jsonb_build_object(
        'webhook_amount', p_amount,
        'expected_amount', v_expected_amount,
        'order_id', v_transaction_record.order_id
      )
    );

    v_result := jsonb_build_object(
      'success', true,
      'transaction_id', v_transaction_record.id,
      'order_id', v_transaction_record.order_id,
      'confirmed_at', p_confirmed_at
    );

    RETURN v_result;

  EXCEPTION
    WHEN OTHERS THEN
      -- Log error
      INSERT INTO public.security_incidents (
        type,
        description,
        severity,
        reference,
        error_message,
        request_data
      ) VALUES (
        'payment_confirmation_error',
        'Error during atomic payment confirmation',
        'high',
        p_reference,
        SQLERRM,
        p_paystack_data
      );
      
      RAISE;
  END;
END;
$function$;

-- Fix log_payment_security_event function
CREATE OR REPLACE FUNCTION public.log_payment_security_event(event_type text, severity text DEFAULT 'medium'::text, details jsonb DEFAULT '{}'::jsonb, ip_address inet DEFAULT NULL::inet, user_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  event_id uuid;
BEGIN
  INSERT INTO public.security_incidents (
    type,
    severity,
    ip_address,
    user_agent,
    request_data,
    created_at
  ) VALUES (
    event_type,
    severity,
    ip_address,
    user_agent,
    details || jsonb_build_object('payment_related', true),
    NOW()
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$function$;

-- Fix get_active_paystack_config function
CREATE OR REPLACE FUNCTION public.get_active_paystack_config()
 RETURNS TABLE(public_key text, secret_key text, webhook_secret text, test_mode boolean, environment text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  env_config RECORD;
BEGIN
  -- Get current environment configuration
  SELECT * INTO env_config FROM public.get_environment_config() LIMIT 1;
  
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
  FROM public.payment_integrations pi
  WHERE pi.provider = 'paystack' 
    AND pi.connection_status = 'connected'
  ORDER BY pi.updated_at DESC
  LIMIT 1;
END;
$function$;

-- Fix get_environment_config function  
CREATE OR REPLACE FUNCTION public.get_environment_config()
 RETURNS TABLE(environment text, is_live_mode boolean, webhook_url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ec.environment,
    ec.is_live_mode,
    ec.webhook_url
  FROM public.environment_config ec
  ORDER BY ec.created_at DESC
  LIMIT 1;
END;
$function$;