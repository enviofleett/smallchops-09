-- Enhanced customer management functions with production validations

-- Create audit log function for customer operations
CREATE OR REPLACE FUNCTION public.log_customer_operation(
  p_action TEXT,
  p_customer_id UUID DEFAULT NULL,
  p_customer_data JSONB DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    action,
    category,
    entity_type,
    entity_id,
    user_id,
    user_name,
    message,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    p_action,
    'Customer Management',
    'customer',
    p_customer_id,
    COALESCE(p_admin_id, auth.uid()),
    (SELECT name FROM profiles WHERE id = COALESCE(p_admin_id, auth.uid())),
    'Customer ' || p_action || ' operation',
    p_customer_data,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Enhanced customer creation function with validations and email queuing
CREATE OR REPLACE FUNCTION public.create_customer_with_validation(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL,
  p_send_welcome_email BOOLEAN DEFAULT TRUE,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
  
  -- Queue welcome email if requested
  IF p_send_welcome_email THEN
    INSERT INTO communication_events (
      event_type,
      recipient_email,
      template_key,
      template_id,
      email_type,
      status,
      variables,
      event_metadata
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
$$;

-- Enhanced customer update function with validation
CREATE OR REPLACE FUNCTION public.update_customer_with_validation(
  p_customer_id UUID,
  p_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_existing_customer RECORD;
  v_sanitized_name TEXT;
  v_sanitized_phone TEXT;
  v_validation_errors TEXT[] := '{}';
  v_old_values JSONB;
  v_new_values JSONB := '{}';
  v_result JSONB;
BEGIN
  -- Get existing customer
  SELECT * INTO v_existing_customer
  FROM customers
  WHERE id = p_customer_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'errors', ARRAY['Customer not found'],
      'message', 'Customer does not exist'
    );
  END IF;
  
  -- Store old values for audit
  v_old_values := jsonb_build_object(
    'name', v_existing_customer.name,
    'email', v_existing_customer.email,
    'phone', v_existing_customer.phone
  );
  
  -- Validate and sanitize inputs
  IF p_name IS NOT NULL THEN
    IF LENGTH(TRIM(p_name)) = 0 THEN
      v_validation_errors := array_append(v_validation_errors, 'Customer name cannot be empty');
    ELSE
      v_sanitized_name := TRIM(regexp_replace(p_name, '<[^>]*>', '', 'g'));
      v_new_values := v_new_values || jsonb_build_object('name', v_sanitized_name);
    END IF;
  END IF;
  
  IF p_email IS NOT NULL THEN
    IF LENGTH(TRIM(p_email)) = 0 THEN
      v_validation_errors := array_append(v_validation_errors, 'Customer email cannot be empty');
    ELSIF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      v_validation_errors := array_append(v_validation_errors, 'Invalid email format');
    ELSE
      -- Check for duplicate email (excluding current customer)
      IF EXISTS (SELECT 1 FROM customers WHERE email = LOWER(TRIM(p_email)) AND id != p_customer_id) THEN
        v_validation_errors := array_append(v_validation_errors, 'Another customer with this email already exists');
      ELSE
        v_new_values := v_new_values || jsonb_build_object('email', LOWER(TRIM(p_email)));
      END IF;
    END IF;
  END IF;
  
  IF p_phone IS NOT NULL THEN
    v_sanitized_phone := regexp_replace(TRIM(p_phone), '[^\d+\-\(\)\s]', '', 'g');
    IF LENGTH(v_sanitized_phone) > 0 AND LENGTH(regexp_replace(v_sanitized_phone, '[^\d]', '', 'g')) < 10 THEN
      v_validation_errors := array_append(v_validation_errors, 'Phone number must contain at least 10 digits');
    ELSE
      v_new_values := v_new_values || jsonb_build_object('phone', v_sanitized_phone);
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
  
  -- Update the customer
  UPDATE customers 
  SET 
    name = COALESCE(v_sanitized_name, name),
    email = COALESCE((v_new_values->>'email'), email),
    phone = COALESCE(v_sanitized_phone, phone),
    updated_at = NOW()
  WHERE id = p_customer_id;
  
  -- Log the operation
  PERFORM log_customer_operation(
    'updated',
    p_customer_id,
    jsonb_build_object(
      'old_values', v_old_values,
      'new_values', v_new_values,
      'updated_by_admin', p_admin_id IS NOT NULL
    ),
    p_admin_id,
    p_ip_address,
    p_user_agent
  );
  
  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'customer_id', p_customer_id,
    'message', 'Customer updated successfully',
    'changes', v_new_values
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    PERFORM log_customer_operation(
      'update_failed',
      p_customer_id,
      jsonb_build_object(
        'attempted_changes', v_new_values,
        'error', SQLERRM
      ),
      p_admin_id,
      p_ip_address,
      p_user_agent
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'errors', ARRAY['Database error: ' || SQLERRM],
      'message', 'Failed to update customer'
    );
END;
$$;

-- Create rate limiting function for customer operations
CREATE OR REPLACE FUNCTION public.check_customer_operation_rate_limit(
  p_admin_id UUID,
  p_operation TEXT,
  p_limit INTEGER DEFAULT 50
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count operations in the last hour
  SELECT COUNT(*) INTO v_count
  FROM audit_logs
  WHERE user_id = p_admin_id
    AND action LIKE '%customer%'
    AND action LIKE '%' || p_operation || '%'
    AND event_time > NOW() - INTERVAL '1 hour';
    
  RETURN v_count < p_limit;
END;
$$;