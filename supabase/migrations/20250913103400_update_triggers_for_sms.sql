-- SMS Communication Channel Implementation
-- Phase 2: Update existing triggers to support SMS events

-- Update the order status change trigger to include SMS events
CREATE OR REPLACE FUNCTION public.queue_order_status_change_communication()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert an event into the queue only when the order status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Queue email event (existing functionality)
    INSERT INTO public.communication_events (order_id, event_type, payload, recipient_email, channel)
    VALUES (
      NEW.id,
      'order_status_update',
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'customer_name', NEW.customer_name,
        'customer_phone', NEW.customer_phone,
        'customer_email', NEW.customer_email,
        'order_number', NEW.order_number,
        'total_amount', NEW.total_amount
      ),
      NEW.customer_email,
      'email'
    );

    -- Queue SMS event if customer has phone number and SMS is enabled
    IF NEW.customer_phone IS NOT NULL AND trim(NEW.customer_phone) != '' THEN
      INSERT INTO public.communication_events (
        order_id, 
        event_type, 
        payload, 
        recipient_phone, 
        channel
      )
      VALUES (
        NEW.id,
        'order_status_sms',
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'customer_name', NEW.customer_name,
          'customer_phone', NEW.customer_phone,
          'customer_email', NEW.customer_email,
          'order_number', NEW.order_number,
          'total_amount', NEW.total_amount
        ),
        NEW.customer_phone,
        'sms'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to queue SMS communication events for orders
CREATE OR REPLACE FUNCTION public.queue_sms_communication_event(
  p_order_id UUID,
  p_event_type TEXT,
  p_recipient_phone TEXT,
  p_payload JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Check if phone number is provided and not suppressed
  IF p_recipient_phone IS NULL OR trim(p_recipient_phone) = '' THEN
    RAISE EXCEPTION 'Recipient phone number is required';
  END IF;

  -- Check if phone is suppressed
  IF is_phone_suppressed(p_recipient_phone) THEN
    RAISE NOTICE 'Phone number % is suppressed, skipping SMS event', p_recipient_phone;
    RETURN NULL;
  END IF;

  -- Insert SMS communication event
  INSERT INTO public.communication_events (
    order_id,
    event_type,
    payload,
    recipient_phone,
    channel,
    status,
    created_at
  ) VALUES (
    p_order_id,
    p_event_type,
    p_payload,
    p_recipient_phone,
    'sms',
    'queued',
    NOW()
  )
  RETURNING id INTO v_event_id;

  -- Log the event creation
  INSERT INTO audit_logs (
    action,
    category,
    message,
    entity_id,
    new_values
  ) VALUES (
    'sms_event_queued',
    'SMS',
    format('SMS event %s queued for order %s', p_event_type, p_order_id),
    p_order_id,
    jsonb_build_object(
      'event_id', v_event_id,
      'event_type', p_event_type,
      'recipient', p_recipient_phone
    )
  );

  RETURN v_event_id;
END;
$$;

-- Function to queue payment confirmation SMS
CREATE OR REPLACE FUNCTION public.upsert_payment_confirmation_sms_event(
  p_order_id UUID,
  p_customer_phone TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id UUID;
  v_order_data RECORD;
  v_template_variables JSONB;
BEGIN
  -- Skip if no phone number
  IF p_customer_phone IS NULL OR trim(p_customer_phone) = '' THEN
    RETURN NULL;
  END IF;

  -- Check if phone is suppressed
  IF is_phone_suppressed(p_customer_phone) THEN
    RAISE NOTICE 'Phone number % is suppressed, skipping payment confirmation SMS', p_customer_phone;
    RETURN NULL;
  END IF;

  -- Get order details
  SELECT o.*, ca.name as customer_name, ca.email as customer_email
  INTO v_order_data
  FROM orders o
  LEFT JOIN customer_accounts ca ON o.customer_id = ca.id
  WHERE o.id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;
  
  -- Build template variables
  v_template_variables := jsonb_build_object(
    'customerName', COALESCE(v_order_data.customer_name, 'Valued Customer'),
    'orderNumber', v_order_data.order_number,
    'orderTotal', '₦' || v_order_data.total_amount::text,
    'paymentReference', v_order_data.payment_reference,
    'businessName', 'Starters Small Chops'
  );
  
  -- Insert or get existing SMS event (idempotent)
  INSERT INTO communication_events (
    event_type,
    recipient_phone,
    variables,
    order_id,
    channel,
    status,
    created_at
  ) VALUES (
    'payment_confirmation_sms',
    p_customer_phone,
    v_template_variables,
    p_order_id,
    'sms',
    'queued',
    NOW()
  )
  ON CONFLICT (order_id, event_type, channel) DO UPDATE SET
    variables = EXCLUDED.variables,
    updated_at = NOW()
  RETURNING id INTO v_event_id;
  
  -- Log the event creation
  INSERT INTO audit_logs (
    action,
    category,
    message,
    entity_id,
    new_values
  ) VALUES (
    'payment_confirmation_sms_queued',
    'SMS',
    'Payment confirmation SMS queued for order: ' || v_order_data.order_number,
    p_order_id,
    jsonb_build_object(
      'event_id', v_event_id,
      'recipient', p_customer_phone
    )
  );
  
  RETURN v_event_id;
END;
$$;

-- Add a unique constraint to prevent duplicate events
ALTER TABLE public.communication_events 
ADD CONSTRAINT communication_events_unique_order_event_channel 
UNIQUE (order_id, event_type, channel);

COMMENT ON CONSTRAINT communication_events_unique_order_event_channel 
ON public.communication_events IS 'Prevents duplicate communication events for the same order, event type, and channel';