-- Phase 1: Fix Database Functions & Triggers for Customer Welcome Emails

-- 1. Drop the outdated trigger_customer_welcome_email function
DROP FUNCTION IF EXISTS public.trigger_customer_welcome_email();

-- 2. Create a proper trigger function for new customer registrations
CREATE OR REPLACE FUNCTION public.handle_new_customer_registration()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger for new customer insertions
  IF TG_OP = 'INSERT' THEN
    -- Queue welcome email using consistent event type and column names
    INSERT INTO public.communication_events (
      event_type,
      recipient_email,
      template_key,
      template_id,
      email_type,
      status,
      variables,
      payload,
      created_at
    ) VALUES (
      'customer_welcome',  -- Consistent event type
      NEW.email,
      'welcome_customer',
      'welcome_customer', 
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', COALESCE(NEW.name, 'Valued Customer'),
        'companyName', (SELECT COALESCE(name, 'Starters') FROM business_settings ORDER BY updated_at DESC LIMIT 1),
        'supportEmail', (SELECT COALESCE(email, 'support@starters.com') FROM business_settings ORDER BY updated_at DESC LIMIT 1),
        'websiteUrl', (SELECT COALESCE(website_url, 'https://starters.com') FROM business_settings ORDER BY updated_at DESC LIMIT 1),
        'siteUrl', (SELECT COALESCE(site_url, 'https://oknnklksdiqaifhxaccs.supabase.co') FROM business_settings ORDER BY updated_at DESC LIMIT 1)
      ),
      jsonb_build_object(
        'customer_id', NEW.id,
        'trigger', 'automatic_registration',
        'registration_type', 'customer_self_registration'
      ),
      NOW()
    );
    
    -- Log the welcome email queuing
    INSERT INTO audit_logs (
      action,
      category,
      entity_type,
      entity_id,
      message,
      new_values
    ) VALUES (
      'welcome_email_queued',
      'Customer Management',
      'customer',
      NEW.id,
      'Welcome email automatically queued for new customer: ' || NEW.email,
      jsonb_build_object(
        'customer_email', NEW.email,
        'customer_name', NEW.name,
        'trigger_type', 'automatic'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3. Create trigger on customers table for automatic welcome emails
DROP TRIGGER IF EXISTS trigger_welcome_email_on_customer_insert ON public.customers;

CREATE TRIGGER trigger_welcome_email_on_customer_insert
  AFTER INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_customer_registration();

-- 4. Update create_customer_with_validation function to use consistent event types
CREATE OR REPLACE FUNCTION public.create_customer_with_validation(p_name text, p_email text, p_phone text DEFAULT NULL::text, p_admin_id uuid DEFAULT NULL::uuid, p_send_welcome_email boolean DEFAULT true, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id UUID;
  v_existing_customer RECORD;
  v_sanitized_name TEXT;
  v_sanitized_phone TEXT;
  v_validation_errors TEXT[] := '{}';
  v_result JSONB;
BEGIN
  -- Input validation and sanitization
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) = 0 THEN
    v_validation_errors := array_append(v_validation_errors, 'Customer name is required');
  END IF;
  
  IF p_email IS NULL OR LENGTH(TRIM(p_email)) = 0 THEN
    v_validation_errors := array_append(v_validation_errors, 'Customer email is required');
  END IF;
  
  -- Email format validation
  IF p_email IS NOT NULL AND p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    v_validation_errors := array_append(v_validation_errors, 'Invalid email format');
  END IF;
  
  -- Check for existing customer with same email
  SELECT * INTO v_existing_customer
  FROM customers
  WHERE email = LOWER(TRIM(p_email));
  
  IF FOUND THEN
    v_validation_errors := array_append(v_validation_errors, 'A customer with this email already exists');
  END IF;
  
  -- Phone validation and sanitization if provided
  IF p_phone IS NOT NULL AND LENGTH(TRIM(p_phone)) > 0 THEN
    v_sanitized_phone := regexp_replace(TRIM(p_phone), '[^\d+\-\(\)\s]', '', 'g');
    IF LENGTH(regexp_replace(v_sanitized_phone, '[^\d]', '', 'g')) < 10 THEN
      v_validation_errors := array_append(v_validation_errors, 'Phone number must contain at least 10 digits');
    END IF;
  END IF;
  
  -- Return validation errors if any
  IF array_length(v_validation_errors, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'errors', v_validation_errors,
      'message', 'Validation failed'
    );
  END IF;
  
  -- Sanitize inputs
  v_sanitized_name := TRIM(regexp_replace(p_name, '<[^>]*>', '', 'g')); -- Remove HTML tags
  
  -- Create the customer (this will automatically trigger the welcome email via the trigger)
  INSERT INTO customers (name, email, phone)
  VALUES (v_sanitized_name, LOWER(TRIM(p_email)), v_sanitized_phone)
  RETURNING id INTO v_customer_id;
  
  -- Log the operation
  PERFORM log_customer_operation(
    'created',
    v_customer_id,
    jsonb_build_object(
      'name', v_sanitized_name,
      'email', LOWER(TRIM(p_email)),
      'phone', v_sanitized_phone,
      'created_by_admin', p_admin_id IS NOT NULL,
      'automatic_welcome_email', true
    ),
    p_admin_id,
    p_ip_address,
    p_user_agent
  );
  
  -- If admin specifically requests NO welcome email, mark the queued email as cancelled
  IF NOT p_send_welcome_email AND p_admin_id IS NOT NULL THEN
    UPDATE communication_events 
    SET status = 'cancelled'::communication_event_status,
        updated_at = NOW()
    WHERE recipient_email = LOWER(TRIM(p_email))
    AND event_type = 'customer_welcome'
    AND status = 'queued'::communication_event_status
    AND created_at >= NOW() - INTERVAL '1 minute'; -- Only cancel very recent events
  END IF;
  
  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'customer_id', v_customer_id,
    'message', 'Customer created successfully with automatic welcome email',
    'welcome_email_queued', p_send_welcome_email
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    PERFORM log_customer_operation(
      'creation_failed',
      NULL,
      jsonb_build_object(
        'name', p_name,
        'email', p_email,
        'phone', p_phone,
        'error', SQLERRM
      ),
      p_admin_id,
      p_ip_address,
      p_user_agent
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'errors', ARRAY['Database error: ' || SQLERRM],
      'message', 'Failed to create customer'
    );
END;
$function$;

-- 5. Fix get_hourly_email_stats function to resolve column ambiguity
CREATE OR REPLACE FUNCTION public.get_hourly_email_stats(start_time timestamp with time zone, end_time timestamp with time zone)
 RETURNS TABLE(hour_bucket timestamp with time zone, total_sent integer, successful_delivered integer, failed_attempts integer, bounce_rate numeric, delivery_rate numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    date_trunc('hour', ce.sent_at) as hour_bucket,
    COUNT(*)::integer as total_sent,
    COUNT(*) FILTER (WHERE edl.delivery_status = 'delivered')::integer as successful_delivered,
    COUNT(*) FILTER (WHERE ce.status = 'failed' OR edl.delivery_status IN ('bounced', 'complained'))::integer as failed_attempts,
    ROUND(
      (COUNT(*) FILTER (WHERE edl.delivery_status IN ('bounced', 'complained'))::numeric / NULLIF(COUNT(*), 0)) * 100, 
      2
    ) as bounce_rate,
    ROUND(
      (COUNT(*) FILTER (WHERE edl.delivery_status = 'delivered')::numeric / NULLIF(COUNT(*), 0)) * 100, 
      2
    ) as delivery_rate
  FROM communication_events ce
  LEFT JOIN smtp_delivery_logs edl ON ce.external_id = edl.email_id
  WHERE ce.sent_at BETWEEN start_time AND end_time
  AND ce.status != 'queued'
  GROUP BY date_trunc('hour', ce.sent_at)
  ORDER BY hour_bucket;
END;
$function$;

-- 6. Add function to requeue failed welcome emails after SMTP is fixed
CREATE OR REPLACE FUNCTION public.requeue_failed_welcome_emails()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_requeued_count INTEGER := 0;
BEGIN
  -- Requeue failed customer welcome emails from the last 24 hours
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
  
  -- Log the requeue operation
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