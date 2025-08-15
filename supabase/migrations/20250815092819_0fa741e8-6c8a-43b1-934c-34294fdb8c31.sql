-- PHASE 1: IMMEDIATE CRITICAL SECURITY FIXES

-- 1. Secure Business Sensitive Data Table
ALTER TABLE business_sensitive_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only access business data" 
ON business_sensitive_data 
FOR ALL 
USING (is_admin());

-- 2. Secure Payment Integration Secrets
ALTER TABLE payment_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only payment secrets" 
ON payment_integrations 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Service role payment access" 
ON payment_integrations 
FOR SELECT 
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage payment integrations" 
ON payment_integrations 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- 3. Secure Environment Configuration
ALTER TABLE environment_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only environment config" 
ON environment_config 
FOR ALL 
USING (is_admin());

-- PHASE 2: DATABASE FUNCTION SECURITY HARDENING

-- Fix database functions missing search_path
CREATE OR REPLACE FUNCTION public.generate_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  timestamp_part text;
  random_part text;
BEGIN
  timestamp_part := extract(epoch from now())::bigint::text;
  random_part := encode(gen_random_bytes(6), 'hex');
  RETURN 'txn_' || timestamp_part || '_' || random_part;
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_intents_set_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.payment_reference IS NULL THEN
    NEW.payment_reference := generate_reference();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_order_id uuid,
  p_amount numeric,
  p_currency text DEFAULT 'NGN'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reference text;
  v_intent_id uuid;
  v_order_exists boolean;
BEGIN
  -- Verify order exists and get details
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = p_order_id) INTO v_order_exists;
  
  IF NOT v_order_exists THEN
    RETURN jsonb_build_object('error', 'Order not found');
  END IF;
  
  -- Generate secure reference
  v_reference := generate_reference();
  
  -- Create payment intent
  INSERT INTO payment_intents (
    order_id,
    amount,
    currency,
    payment_reference,
    status
  ) VALUES (
    p_order_id,
    p_amount,
    p_currency,
    v_reference,
    'pending'
  ) RETURNING id INTO v_intent_id;
  
  -- Update order with payment reference
  UPDATE orders 
  SET payment_reference = v_reference
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'intent_id', v_intent_id,
    'payment_reference', v_reference,
    'amount', p_amount,
    'currency', p_currency
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.on_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' 
     AND OLD.payment_status != 'paid' 
     AND NEW.payment_status = 'paid' THEN
    
    -- Log the payment success
    INSERT INTO audit_logs (
      action,
      category,
      message,
      entity_id,
      new_values
    ) VALUES (
      'order_payment_confirmed',
      'Payment Security',
      'Order payment confirmed: ' || NEW.order_number,
      NEW.id,
      jsonb_build_object(
        'order_id', NEW.id,
        'payment_reference', NEW.payment_reference,
        'amount', NEW.total_amount
      )
    );
    
    -- Update payment intent status
    UPDATE payment_intents 
    SET 
      status = 'completed',
      completed_at = now()
    WHERE order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Enhanced Security Monitoring and Audit Functions

CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  table_name text,
  operation text,
  record_id uuid DEFAULT NULL,
  user_context jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values
  ) VALUES (
    'sensitive_data_access',
    'Security Monitoring',
    format('Sensitive data access: %s.%s', table_name, operation),
    auth.uid(),
    record_id,
    jsonb_build_object(
      'table', table_name,
      'operation', operation,
      'user_context', user_context,
      'timestamp', now()
    )
  );
END;
$$;

-- 5. Create comprehensive security incident logging
CREATE OR REPLACE FUNCTION public.log_security_violation(
  violation_type text,
  description text,
  severity text DEFAULT 'medium',
  metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  incident_id uuid;
BEGIN
  INSERT INTO security_incidents (
    type,
    description,
    severity,
    user_id,
    request_data,
    created_at
  ) VALUES (
    violation_type,
    description,
    severity,
    auth.uid(),
    metadata || jsonb_build_object(
      'function_context', 'log_security_violation',
      'timestamp', now()
    ),
    now()
  ) RETURNING id INTO incident_id;
  
  RETURN incident_id;
END;
$$;

-- 6. Add triggers for sensitive data access monitoring
CREATE OR REPLACE FUNCTION public.monitor_business_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM log_sensitive_data_access(
    'business_sensitive_data',
    TG_OP,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object('user_role', 'admin_required')
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER business_data_access_monitor
  AFTER INSERT OR UPDATE OR DELETE ON business_sensitive_data
  FOR EACH ROW EXECUTE FUNCTION monitor_business_data_access();

-- 7. Enhanced payment security monitoring
CREATE OR REPLACE FUNCTION public.monitor_payment_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log any access to payment integration secrets
  PERFORM log_sensitive_data_access(
    'payment_integrations',
    TG_OP,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'provider', COALESCE(NEW.provider, OLD.provider),
      'access_level', 'payment_secrets'
    )
  );
  
  -- Alert on any unauthorized access attempts
  IF NOT (is_admin() OR auth.role() = 'service_role') THEN
    PERFORM log_security_violation(
      'unauthorized_payment_access',
      'Unauthorized attempt to access payment integration secrets',
      'critical',
      jsonb_build_object(
        'user_id', auth.uid(),
        'operation', TG_OP,
        'table', 'payment_integrations'
      )
    );
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_access_monitor
  AFTER INSERT OR UPDATE OR DELETE ON payment_integrations
  FOR EACH ROW EXECUTE FUNCTION monitor_payment_access();