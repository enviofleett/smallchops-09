-- CRITICAL SECURITY FIXES - Phase 2
-- Fix remaining database functions missing SET search_path

-- Fix remaining functions that need SET search_path
CREATE OR REPLACE FUNCTION public.get_smtp_config_with_fallback()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_config RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_config
  FROM communication_settings
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'primary', jsonb_build_object(
        'host', 'mail.startersmallchops.com',
        'port', 587,
        'auth', jsonb_build_object(
          'user', 'store@startersmallchops.com',
          'pass', ''
        ),
        'secure', false
      ),
      'fallback', jsonb_build_object(
        'host', 'mail.startersmallchops.com',
        'port', 465,
        'auth', jsonb_build_object(
          'user', 'store@startersmallchops.com',
          'pass', ''
        ),
        'secure', true
      ),
      'timeout', 15000,
      'retry_attempts', 2
    );
  END IF;
  
  v_result := jsonb_build_object(
    'primary', jsonb_build_object(
      'host', v_config.smtp_host,
      'port', 587,
      'auth', jsonb_build_object(
        'user', v_config.smtp_user,
        'pass', v_config.smtp_pass
      ),
      'secure', false
    ),
    'fallback', jsonb_build_object(
      'host', v_config.smtp_host,
      'port', 465,
      'auth', jsonb_build_object(
        'user', v_config.smtp_user,
        'pass', v_config.smtp_pass
      ),
      'secure', true
    ),
    'timeout', 15000,
    'retry_attempts', 2
  );
  
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_payment_transaction_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.backfill_order_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_order_number text;
BEGIN
  IF NEW.status NOT IN ('success','paid') THEN
    RETURN NEW;
  END IF;

  IF NEW.order_id IS NULL THEN
    IF NEW.metadata ? 'order_id' AND NEW.metadata->>'order_id' ~* '^[0-9a-f-]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT id INTO v_order_id FROM orders WHERE id = (NEW.metadata->>'order_id')::uuid;
    END IF;

    IF v_order_id IS NULL AND NEW.provider_reference IS NOT NULL THEN
      SELECT id INTO v_order_id FROM orders WHERE payment_reference = NEW.provider_reference;
    END IF;

    IF v_order_id IS NULL AND NEW.metadata ? 'order_number' THEN
      v_order_number := NEW.metadata->>'order_number';
      SELECT id INTO v_order_id FROM orders WHERE order_number = v_order_number;
    END IF;

    IF v_order_id IS NOT NULL THEN
      UPDATE payment_transactions
      SET order_id = v_order_id,
          updated_at = now()
      WHERE id = NEW.id;

      UPDATE orders
      SET 
        payment_status = 'paid',
        paid_at = COALESCE(orders.paid_at, NEW.paid_at, now()),
        status = CASE 
          WHEN status IN ('pending','confirmed','preparing') THEN 'confirmed'
          ELSE status
        END,
        updated_at = now()
      WHERE id = v_order_id;
    END IF;
  ELSE
    UPDATE orders
    SET 
      payment_status = 'paid',
      paid_at = COALESCE(orders.paid_at, NEW.paid_at, now()),
      status = CASE 
        WHEN status IN ('pending','confirmed','preparing') THEN 'confirmed'
        ELSE status
      END,
      updated_at = now()
    WHERE id = NEW.order_id
      AND (orders.payment_status IS DISTINCT FROM 'paid' OR orders.paid_at IS NULL);
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix remaining critical functions with SET search_path
CREATE OR REPLACE FUNCTION public.requeue_failed_welcome_emails()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_requeued_count INTEGER := 0;
BEGIN
  UPDATE communication_events 
  SET 
    status = 'queued'::communication_event_status,
    retry_count = 0,
    last_error = NULL,
    error_message = NULL,
    updated_at = NOW()
  WHERE event_type = 'customer_welcome'
  AND status = 'failed'::communication_event_status
  AND created_at >= NOW() - INTERVAL '24 hours'
  AND (error_message ILIKE '%suspended%' OR error_message ILIKE '%SMTP%' OR last_error ILIKE '%550%');
  
  GET DIAGNOSTICS v_requeued_count = ROW_COUNT;
  
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'requeue_failed_emails',
    'Email Processing',
    'Requeued ' || v_requeued_count || ' failed welcome emails after SMTP fix',
    jsonb_build_object('requeued_count', v_requeued_count)
  );
  
  RETURN v_requeued_count;
END;
$function$;

-- Log Phase 2 completion
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'critical_security_fixes_phase2_completed',
  'Security',
  'Completed Phase 2 security fixes: Added SET search_path to remaining critical database functions',
  jsonb_build_object(
    'additional_functions_fixed', 4,
    'total_functions_secured', 9,
    'security_level', 'CRITICAL',
    'phase', 2
  )
);