-- Drop existing conflicting policies and create comprehensive email system security
DROP POLICY IF EXISTS "Admins can manage email templates" ON enhanced_email_templates;
DROP POLICY IF EXISTS "Service role can read email templates" ON enhanced_email_templates;

-- Recreate email template policies
CREATE POLICY "Admins can manage email templates" ON enhanced_email_templates
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Service role can read email templates" ON enhanced_email_templates
  FOR SELECT USING (auth.role() = 'service_role');

-- Fix search path issues for email functions
CREATE OR REPLACE FUNCTION check_email_rate_limit(email_address text, time_window_minutes integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  email_count INTEGER;
  hourly_limit INTEGER := 10;
BEGIN
  SELECT COUNT(*) INTO email_count
  FROM communication_events
  WHERE recipient_email = email_address
    AND status = 'sent'
    AND sent_at > NOW() - (time_window_minutes || ' minutes')::INTERVAL;
  
  RETURN jsonb_build_object(
    'allowed', email_count < hourly_limit,
    'current_count', email_count,
    'limit', hourly_limit,
    'reset_at', NOW() + (time_window_minutes || ' minutes')::INTERVAL
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_email_suppressed(email_address text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM email_suppression_list 
    WHERE email = LOWER(email_address) 
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM email_bounce_tracking 
    WHERE email_address = LOWER(email_address)
    AND bounce_type = 'hard'
    AND suppressed_at IS NOT NULL
  ) THEN
    RETURN true;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM email_unsubscribes 
    WHERE email = LOWER(email_address)
    AND unsubscribed_at IS NOT NULL
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Create email queue processing security function
CREATE OR REPLACE FUNCTION process_email_queue_secure(batch_size INTEGER DEFAULT 50, priority_filter TEXT DEFAULT 'all')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  processed_count INTEGER := 0;
  failed_count INTEGER := 0;
  queue_record RECORD;
BEGIN
  -- Only allow service role or admins
  IF NOT (auth.role() = 'service_role' OR is_admin()) THEN
    RAISE EXCEPTION 'Unauthorized: Only service roles or admins can process email queue';
  END IF;

  FOR queue_record IN 
    SELECT * FROM communication_events 
    WHERE status = 'queued' 
    AND (priority_filter = 'all' OR priority = priority_filter)
    AND retry_count < 3
    ORDER BY priority DESC, created_at ASC
    LIMIT batch_size
  LOOP
    BEGIN
      -- Mark as processing
      UPDATE communication_events 
      SET status = 'processing', 
          processing_started_at = NOW()
      WHERE id = queue_record.id;
      
      processed_count := processed_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      
      UPDATE communication_events 
      SET status = 'failed',
          error_message = SQLERRM,
          retry_count = retry_count + 1
      WHERE id = queue_record.id;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'processed', processed_count,
    'failed', failed_count,
    'timestamp', NOW()
  );
END;
$$;

-- Create comprehensive email delivery webhook handler
CREATE OR REPLACE FUNCTION handle_email_webhook(
  webhook_data JSONB,
  webhook_type TEXT DEFAULT 'delivery'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  message_id TEXT;
  email_address TEXT;
  delivery_status TEXT;
  bounce_type TEXT;
  error_message TEXT;
BEGIN
  -- Only allow service role
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service roles can handle webhooks';
  END IF;

  -- Extract common fields
  message_id := webhook_data->>'message_id';
  email_address := LOWER(webhook_data->>'email');
  delivery_status := webhook_data->>'status';

  -- Handle different webhook types
  CASE webhook_type
    WHEN 'delivery' THEN
      -- Update delivery logs
      INSERT INTO smtp_delivery_logs (
        message_id, recipient_email, delivery_status, 
        smtp_response, provider, metadata
      ) VALUES (
        message_id, email_address, delivery_status,
        webhook_data->>'response', 'webhook', webhook_data
      );
      
    WHEN 'bounce' THEN
      bounce_type := webhook_data->>'bounce_type';
      error_message := webhook_data->>'error_message';
      
      -- Record bounce
      INSERT INTO email_bounce_tracking (
        email_address, bounce_type, bounce_reason, 
        message_id, bounce_timestamp
      ) VALUES (
        email_address, bounce_type, error_message,
        message_id, NOW()
      );
      
      -- Suppress if hard bounce
      IF bounce_type = 'hard' THEN
        PERFORM suppress_email_address(email_address, 'hard_bounce', bounce_type, 'webhook');
      END IF;
      
    WHEN 'complaint' THEN
      -- Record complaint and suppress immediately
      INSERT INTO email_bounce_tracking (
        email_address, bounce_type, bounce_reason,
        message_id, bounce_timestamp
      ) VALUES (
        email_address, 'complaint', 'spam_complaint',
        message_id, NOW()
      );
      
      PERFORM suppress_email_address(email_address, 'spam_complaint', 'complaint', 'webhook');
      
  END CASE;
  
  RETURN true;
END;
$$;

-- Create email template validation function
CREATE OR REPLACE FUNCTION validate_email_template(
  template_data JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  validation_errors TEXT[] := '{}';
  required_fields TEXT[] := ARRAY['template_key', 'template_name', 'subject_template', 'html_template'];
  field TEXT;
BEGIN
  -- Check required fields
  FOREACH field IN ARRAY required_fields
  LOOP
    IF NOT (template_data ? field) OR LENGTH(TRIM(template_data->>field)) = 0 THEN
      validation_errors := array_append(validation_errors, 'Missing required field: ' || field);
    END IF;
  END LOOP;
  
  -- Validate template key format
  IF template_data ? 'template_key' AND template_data->>'template_key' !~ '^[a-z0-9_]+$' THEN
    validation_errors := array_append(validation_errors, 'Template key must contain only lowercase letters, numbers, and underscores');
  END IF;
  
  -- Check for potentially dangerous content
  IF template_data ? 'html_template' AND template_data->>'html_template' ~ '<script|javascript:|data:' THEN
    validation_errors := array_append(validation_errors, 'Template contains potentially dangerous content');
  END IF;
  
  RETURN jsonb_build_object(
    'valid', array_length(validation_errors, 1) IS NULL,
    'errors', validation_errors
  );
END;
$$;