-- ============================================
-- Manual Email System: Database Functions
-- ============================================

-- 1. Create email template validation function
CREATE OR REPLACE FUNCTION validate_email_template(p_template_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template RECORD;
  v_errors text[] := '{}';
BEGIN
  -- Get template
  SELECT * INTO v_template
  FROM enhanced_email_templates
  WHERE template_key = p_template_key
  AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'errors', jsonb_build_array('Template not found or inactive')
    );
  END IF;
  
  -- Validate template has required fields
  IF v_template.subject_template IS NULL OR LENGTH(TRIM(v_template.subject_template)) = 0 THEN
    v_errors := array_append(v_errors, 'Missing subject template');
  END IF;
  
  IF v_template.html_template IS NULL OR LENGTH(TRIM(v_template.html_template)) = 0 THEN
    v_errors := array_append(v_errors, 'Missing HTML template');
  END IF;
  
  IF array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'errors', array_to_json(v_errors)::jsonb
    );
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'template', row_to_json(v_template)::jsonb
  );
END;
$$;

-- 2. Create email preview generation function
CREATE OR REPLACE FUNCTION preview_order_email(
  p_order_id uuid,
  p_template_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_template RECORD;
  v_subject text;
  v_html text;
  v_variables jsonb;
BEGIN
  -- Get order
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- Get template
  SELECT * INTO v_template
  FROM enhanced_email_templates
  WHERE template_key = p_template_key
  AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Template not found or inactive'
    );
  END IF;
  
  -- Build variables
  v_variables := jsonb_build_object(
    'customer_name', COALESCE(v_order.customer_name, 'Customer'),
    'order_number', v_order.order_number,
    'order_status', v_order.status,
    'total_amount', v_order.total_amount,
    'order_date', to_char(v_order.created_at, 'YYYY-MM-DD HH24:MI')
  );
  
  -- Replace variables in subject
  v_subject := v_template.subject_template;
  v_subject := replace(v_subject, '{{customer_name}}', v_variables->>'customer_name');
  v_subject := replace(v_subject, '{{order_number}}', v_variables->>'order_number');
  
  -- Replace variables in HTML
  v_html := v_template.html_template;
  v_html := replace(v_html, '{{customer_name}}', v_variables->>'customer_name');
  v_html := replace(v_html, '{{order_number}}', v_variables->>'order_number');
  v_html := replace(v_html, '{{order_status}}', v_variables->>'order_status');
  v_html := replace(v_html, '{{total_amount}}', v_variables->>'total_amount');
  
  RETURN jsonb_build_object(
    'success', true,
    'preview', jsonb_build_object(
      'subject', v_subject,
      'html', v_html,
      'variables', v_variables
    )
  );
END;
$$;

-- 3. Enhance manual email send function with validation
CREATE OR REPLACE FUNCTION send_order_email_manual(
  p_order_id uuid,
  p_template_key text,
  p_admin_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_template RECORD;
  v_event_id uuid;
  v_dedupe_key text;
BEGIN
  -- Validate template
  SELECT * INTO v_template
  FROM enhanced_email_templates
  WHERE template_key = p_template_key
  AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Template not found or inactive'
    );
  END IF;
  
  -- Get order
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- Check customer email
  IF v_order.customer_email IS NULL OR LENGTH(TRIM(v_order.customer_email)) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Customer email is missing'
    );
  END IF;
  
  -- Generate unique dedupe key
  v_dedupe_key := 'manual_' || p_order_id::text || '_' || p_template_key || '_' || 
                  EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '_' ||
                  gen_random_uuid()::text;
  
  -- Queue email
  INSERT INTO communication_events (
    event_type,
    recipient_email,
    template_key,
    template_variables,
    status,
    dedupe_key,
    order_id,
    priority,
    email_type,
    source,
    created_at,
    updated_at
  ) VALUES (
    'manual_order_email',
    v_order.customer_email,
    p_template_key,
    jsonb_build_object(
      'customer_name', COALESCE(v_order.customer_name, 'Customer'),
      'order_number', v_order.order_number,
      'order_status', v_order.status,
      'total_amount', v_order.total_amount,
      'order_date', to_char(v_order.created_at, 'YYYY-MM-DD HH24:MI')
    ),
    'queued',
    v_dedupe_key,
    p_order_id,
    'high',
    'transactional',
    'manual_admin',
    now(),
    now()
  )
  RETURNING id INTO v_event_id;
  
  -- Log admin action
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values
  ) VALUES (
    'manual_email_sent',
    'Email Management',
    'Admin manually sent ' || p_template_key || ' email for order ' || v_order.order_number,
    p_admin_id,
    p_order_id,
    jsonb_build_object(
      'template_key', p_template_key,
      'recipient', v_order.customer_email,
      'event_id', v_event_id
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'message', 'Email queued successfully'
  );
END;
$$;

-- 4. Create batch email processing function
CREATE OR REPLACE FUNCTION process_email_queue_batch(p_batch_size integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed integer := 0;
  v_failed integer := 0;
  v_event RECORD;
BEGIN
  -- Process queued emails
  FOR v_event IN
    SELECT *
    FROM communication_events
    WHERE status = 'queued'
    AND scheduled_at <= now()
    ORDER BY priority DESC, created_at ASC
    LIMIT p_batch_size
  LOOP
    BEGIN
      -- Mark as processing
      UPDATE communication_events
      SET status = 'processing',
          processing_started_at = now(),
          updated_at = now()
      WHERE id = v_event.id;
      
      -- Actual email sending would happen here via edge function
      -- For now, mark as sent
      UPDATE communication_events
      SET status = 'sent',
          sent_at = now(),
          processed_at = now(),
          updated_at = now()
      WHERE id = v_event.id;
      
      v_processed := v_processed + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- Mark as failed
      UPDATE communication_events
      SET status = 'failed',
          error_message = SQLERRM,
          retry_count = retry_count + 1,
          processed_at = now(),
          updated_at = now()
      WHERE id = v_event.id;
      
      v_failed := v_failed + 1;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'failed', v_failed
  );
END;
$$;

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION validate_email_template(text) TO authenticated;
GRANT EXECUTE ON FUNCTION preview_order_email(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION send_order_email_manual(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION process_email_queue_batch(integer) TO service_role;