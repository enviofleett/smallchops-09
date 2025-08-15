-- Fix security issues: Add search_path to all functions and remove security definer view

-- Fix function search path issues for all security definer functions
DROP FUNCTION IF EXISTS public.get_payment_flow_health();
CREATE OR REPLACE FUNCTION public.get_payment_flow_health()
 RETURNS TABLE(period text, total_orders bigint, completed_orders bigint, pending_orders bigint, paid_orders bigint, payment_pending bigint, completion_rate_percent numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT 
    p.period,
    p.total_orders,
    p.completed_orders,
    p.pending_orders,
    p.paid_orders,
    p.payment_pending,
    p.completion_rate_percent
  FROM public.payment_flow_health p
  WHERE public.is_admin();
$function$;

DROP FUNCTION IF EXISTS public.get_production_metrics();
CREATE OR REPLACE FUNCTION public.get_production_metrics()
 RETURNS TABLE(total_products bigint, total_paid_orders bigint, total_paying_customers bigint, total_revenue numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT 
    pm.total_products,
    pm.total_paid_orders,
    pm.total_paying_customers,
    pm.total_revenue
  FROM public.production_metrics pm
  WHERE public.is_admin();
$function$;

-- Fix generate_payment_reference function
DROP FUNCTION IF EXISTS public.generate_payment_reference();
CREATE OR REPLACE FUNCTION public.generate_payment_reference()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN 'txn_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || gen_random_uuid()::text;
END;
$function$;

-- Fix generate_secure_payment_reference function
DROP FUNCTION IF EXISTS public.generate_secure_payment_reference();
CREATE OR REPLACE FUNCTION public.generate_secure_payment_reference()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN 'txn_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || gen_random_uuid()::text;
END;
$function$;

-- Fix generate_guest_session_id function
DROP FUNCTION IF EXISTS public.generate_guest_session_id();
CREATE OR REPLACE FUNCTION public.generate_guest_session_id()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN 'guest_' || encode(gen_random_bytes(16), 'hex');
END;
$function$;

-- Fix check_production_security function
DROP FUNCTION IF EXISTS public.check_production_security();
CREATE OR REPLACE FUNCTION public.check_production_security()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_active_paystack_config') THEN
    RETURN false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_integrations') THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$function$;

-- Fix check_production_readiness function
DROP FUNCTION IF EXISTS public.check_production_readiness();
CREATE OR REPLACE FUNCTION public.check_production_readiness()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_score INTEGER := 0;
  v_issues TEXT[] := '{}';
  v_warnings TEXT[] := '{}';
  v_ready BOOLEAN := false;
  v_table_count INTEGER;
  v_orders_count INTEGER;
  v_business_settings_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('orders', 'products', 'business_settings', 'payment_transactions');
  
  IF v_table_count = 4 THEN
    v_score := v_score + 20;
  ELSE
    v_issues := array_append(v_issues, 'Core database tables missing');
  END IF;
  
  SELECT COUNT(*) INTO v_business_settings_count FROM business_settings;
  IF v_business_settings_count > 0 THEN
    v_score := v_score + 20;
  ELSE
    v_issues := array_append(v_issues, 'Business settings not configured');
  END IF;
  
  SELECT COUNT(*) INTO v_orders_count FROM orders;
  IF v_orders_count > 0 THEN
    v_score := v_score + 15;
  ELSE
    v_warnings := array_append(v_warnings, 'No orders found - system has not been tested');
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename = 'orders' 
      AND rowsecurity = true
  ) THEN
    v_score := v_score + 15;
  ELSE
    v_issues := array_append(v_issues, 'Row Level Security not enabled on orders table');
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    v_score := v_score + 10;
  ELSE
    v_warnings := array_append(v_warnings, 'Audit logging table not found');
  END IF;
  
  IF EXISTS (SELECT 1 FROM communication_settings) THEN
    v_score := v_score + 10;
  ELSE
    v_warnings := array_append(v_warnings, 'Communication settings not configured');
  END IF;
  
  IF EXISTS (SELECT 1 FROM products WHERE is_active = true) THEN
    v_score := v_score + 10;
  ELSE
    v_issues := array_append(v_issues, 'No active products found');
  END IF;
  
  v_ready := v_score >= 80 AND array_length(v_issues, 1) IS NULL;
  
  RETURN jsonb_build_object(
    'ready_for_production', v_ready,
    'score', v_score,
    'issues', v_issues,
    'warnings', v_warnings
  );
END;
$function$;

-- Fix cleanup_expired_rate_limits function
DROP FUNCTION IF EXISTS public.cleanup_expired_rate_limits();
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  DELETE FROM public.enhanced_rate_limits WHERE window_end < NOW();
END;
$function$;

-- Fix check_payment_flow_health function  
DROP FUNCTION IF EXISTS public.check_payment_flow_health();
CREATE OR REPLACE FUNCTION public.check_payment_flow_health()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_health RECORD;
  v_alerts JSON[];
BEGIN
  SELECT * INTO v_health FROM payment_flow_health WHERE period = 'last_24h';
  
  v_alerts := ARRAY[]::JSON[];
  
  IF v_health.completion_rate_percent < 90 THEN
    v_alerts := v_alerts || json_build_object(
      'severity', 'critical',
      'message', 'Order completion rate below 90%: ' || v_health.completion_rate_percent || '%'
    );
  END IF;
  
  IF v_health.pending_orders > 10 THEN
    v_alerts := v_alerts || json_build_object(
      'severity', 'warning',
      'message', 'High number of pending orders: ' || v_health.pending_orders
    );
  END IF;
  
  RETURN json_build_object(
    'health_status', v_health,
    'alerts', v_alerts,
    'timestamp', NOW()
  );
END;
$function$;

-- Fix get_smtp_config_with_fallback function
DROP FUNCTION IF EXISTS public.get_smtp_config_with_fallback();
CREATE OR REPLACE FUNCTION public.get_smtp_config_with_fallback()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
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

-- Fix emergency_backfill_broken_orders function
DROP FUNCTION IF EXISTS public.emergency_backfill_broken_orders();
CREATE OR REPLACE FUNCTION public.emergency_backfill_broken_orders()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_fixed_count INTEGER := 0;
  v_order_record RECORD;
BEGIN
  FOR v_order_record IN
    SELECT DISTINCT o.id, o.payment_reference, o.total_amount
    FROM orders o
    WHERE 
      o.status = 'pending' 
      AND o.payment_status = 'pending'
      AND o.created_at > NOW() - INTERVAL '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM payment_transactions pt 
        WHERE pt.order_id = o.id OR pt.provider_reference = o.payment_reference
      )
  LOOP
    UPDATE orders 
    SET 
      status = 'cancelled',
      payment_status = 'failed',
      updated_at = NOW()
    WHERE id = v_order_record.id;
    
    INSERT INTO audit_logs (
      action,
      category,
      message,
      new_values
    ) VALUES (
      'emergency_order_cancellation',
      'Payment Recovery',
      'Order cancelled due to missing payment transaction record',
      jsonb_build_object(
        'order_id', v_order_record.id,
        'payment_reference', v_order_record.payment_reference,
        'total_amount', v_order_record.total_amount
      )
    );
    
    v_fixed_count := v_fixed_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'orders_marked_for_review', v_fixed_count,
    'message', 'Orders marked as cancelled due to missing payment records'
  );
END;
$function$;