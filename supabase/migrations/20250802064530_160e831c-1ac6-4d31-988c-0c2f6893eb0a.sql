-- Fix the create_customer_with_validation function to use correct column names
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
  
  -- Create the customer
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
      'created_by_admin', p_admin_id IS NOT NULL
    ),
    p_admin_id,
    p_ip_address,
    p_user_agent
  );
  
  -- Queue welcome email if requested - using correct column names
  IF p_send_welcome_email THEN
    INSERT INTO communication_events (
      event_type,
      recipient_email,
      template_key,
      template_id,
      email_type,
      status,
      variables,
      payload
    ) VALUES (
      'customer_welcome',
      LOWER(TRIM(p_email)),
      'welcome_customer',
      'welcome_customer',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', v_sanitized_name,
        'companyName', 'Starters',
        'adminCreated', p_admin_id IS NOT NULL
      ),
      jsonb_build_object(
        'customer_id', v_customer_id,
        'created_by_admin', p_admin_id IS NOT NULL,
        'admin_id', p_admin_id
      )
    );
  END IF;
  
  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'customer_id', v_customer_id,
    'message', 'Customer created successfully',
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