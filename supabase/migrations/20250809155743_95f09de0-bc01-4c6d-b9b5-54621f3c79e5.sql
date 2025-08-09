-- Tighten RLS and add security hardening

-- 1) Remove overly permissive policies on order_items
DROP POLICY IF EXISTS "Allow authenticated users full access to order items" ON public.order_items;
DROP POLICY IF EXISTS "Order items access derived from parent order" ON public.order_items;
DROP POLICY IF EXISTS "Public can create order items" ON public.order_items;

-- Keep existing targeted policies:
--   - "Admins can manage all order items" (ALL USING is_admin())
--   - "Customers can create order items during checkout" (INSERT with parent order linkage)
--   - "Customers can view their own order items" (SELECT with parent order linkage)
--   - "Service roles can manage order items" (ALL USING auth.role() = 'service_role')

-- 2) Restrict audit_logs inserts (remove public/anon access)
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.audit_logs;

-- Allow only authenticated users to insert (keeps app UX while blocking anonymous abuse)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'audit_logs' AND policyname = 'Authenticated users can insert logs'
  ) THEN
    CREATE POLICY "Authenticated users can insert logs"
    ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;
END $$;

-- Note: "Service roles can insert audit logs" policy already exists and remains intact

-- 3) Prevent role escalation on profiles via trigger
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Only admins can change any user's role
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can change roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create/replace the trigger
DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_escalation();

-- 4) Harden SECURITY DEFINER functions with explicit search_path
-- record_smtp_health_metric
CREATE OR REPLACE FUNCTION public.record_smtp_health_metric(p_provider_name text, p_metric_type text, p_metric_value numeric, p_threshold_value numeric DEFAULT NULL::numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_threshold_breached BOOLEAN := false;
BEGIN
  -- Check if threshold is breached
  IF p_threshold_value IS NOT NULL THEN
    CASE p_metric_type
      WHEN 'bounce_rate', 'complaint_rate', 'error_rate' THEN
        v_threshold_breached := p_metric_value > p_threshold_value;
      WHEN 'connection_time', 'send_time' THEN
        v_threshold_breached := p_metric_value > p_threshold_value;
      ELSE
        v_threshold_breached := false;
    END CASE;
  END IF;

  -- Insert metric
  INSERT INTO smtp_health_metrics (
    provider_name, metric_type, metric_value, threshold_value, threshold_breached
  ) VALUES (
    p_provider_name, p_metric_type, p_metric_value, p_threshold_value, v_threshold_breached
  );

  -- Update provider health score if threshold breached
  IF v_threshold_breached THEN
    UPDATE smtp_provider_configs
    SET health_score = GREATEST(health_score - 10, 0),
        consecutive_failures = consecutive_failures + 1,
        last_failure_at = NOW()
    WHERE name = p_provider_name;
  ELSE
    -- Gradually recover health score
    UPDATE smtp_provider_configs
    SET health_score = LEAST(health_score + 1, 100),
        consecutive_failures = 0
    WHERE name = p_provider_name;
  END IF;
END;
$function$;

-- trigger_update_reputation
CREATE OR REPLACE FUNCTION public.trigger_update_reputation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_domain TEXT;
BEGIN
  -- Extract domain from email
  v_domain := split_part(NEW.email_address, '@', 2);
  -- Update reputation score for the domain
  PERFORM calculate_sender_reputation(v_domain);
  RETURN NEW;
END;
$function$;

-- trigger_instant_email_processing
CREATE OR REPLACE FUNCTION public.trigger_instant_email_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger for queued welcome emails
  IF NEW.status = 'queued' AND NEW.event_type = 'customer_welcome' THEN
    -- Use pg_notify to trigger background processing
    PERFORM pg_notify('instant_email_processing', 
      jsonb_build_object(
        'event_id', NEW.id,
        'event_type', NEW.event_type,
        'recipient', NEW.recipient_email,
        'timestamp', NOW()
      )::text
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- process_stuck_emails
CREATE OR REPLACE FUNCTION public.process_stuck_emails()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  processed_count INTEGER := 0;
BEGIN
  -- Reset stuck emails to trigger reprocessing
  UPDATE communication_events 
  SET status = 'queued'::communication_event_status,
      retry_count = 0,
      updated_at = NOW(),
      error_message = NULL,
      last_error = NULL
  WHERE status = 'queued'::communication_event_status
    AND created_at < NOW() - INTERVAL '2 minutes';
    
  GET DIAGNOSTICS processed_count = ROW_COUNT;
  
  -- Log the processing
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'email_stuck_processing',
    'Email System',
    'Reset ' || processed_count || ' stuck emails for reprocessing',
    jsonb_build_object('processed_count', processed_count)
  );
  
  RETURN processed_count;
END;
$function$;

-- recover_failed_registration
CREATE OR REPLACE FUNCTION public.recover_failed_registration(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_auth_user_id uuid;
    v_customer_id uuid;
    v_recovery_actions text[] := '{}';
    v_result jsonb;
BEGIN
    -- Get auth user ID
    SELECT id INTO v_auth_user_id FROM auth.users WHERE email = p_email;
    
    IF v_auth_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No auth user found for email: ' || p_email
        );
    END IF;
    
    -- Ensure customer record exists
    INSERT INTO public.customers (name, email, phone)
    VALUES (
        split_part(p_email, '@', 1),
        p_email,
        NULL
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO v_customer_id;
    
    IF v_customer_id IS NOT NULL THEN
        v_recovery_actions := array_append(v_recovery_actions, 'created_customer_record');
    ELSE
        SELECT id INTO v_customer_id FROM public.customers WHERE email = p_email;
        v_recovery_actions := array_append(v_recovery_actions, 'found_existing_customer');
    END IF;
    
    -- Ensure customer account link exists
    INSERT INTO public.customer_accounts (user_id, name, phone)
    VALUES (
        v_auth_user_id,
        split_part(p_email, '@', 1),
        NULL
    )
    ON CONFLICT (user_id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = now();
        
    v_recovery_actions := array_append(v_recovery_actions, 'linked_customer_account');
    
    -- Queue welcome email if not already sent
    IF NOT EXISTS (
        SELECT 1 FROM public.communication_events 
        WHERE recipient_email = p_email 
        AND event_type = 'customer_welcome'
        AND status IN ('sent', 'delivered')
    ) THEN
        INSERT INTO public.communication_events (
            event_type, recipient_email, status, template_variables, email_type
        ) VALUES (
            'customer_welcome',
            p_email,
            'queued'::communication_event_status,
            jsonb_build_object(
                'customer_name', split_part(p_email, '@', 1),
                'customer_email', p_email
            ),
            'transactional'
        );
        v_recovery_actions := array_append(v_recovery_actions, 'queued_welcome_email');
    END IF;
    
    -- Log recovery action
    INSERT INTO public.registration_attempts (
        email, attempt_type, status, user_id, customer_id, error_details
    ) VALUES (
        p_email, 'recovery', 'success', v_auth_user_id, v_customer_id,
        jsonb_build_object(
            'recovery_actions', v_recovery_actions,
            'recovered_at', now()
        )
    );
    
    v_result := jsonb_build_object(
        'success', true,
        'email', p_email,
        'auth_user_id', v_auth_user_id,
        'customer_id', v_customer_id,
        'recovery_actions', v_recovery_actions,
        'recovered_at', now()
    );
    
    RETURN v_result;
END;
$function$;