-- Fix the payment confirmation trigger to ensure proper email sending
CREATE OR REPLACE FUNCTION public.upsert_payment_confirmation_event(
  p_order_id UUID,
  p_template_key TEXT DEFAULT 'payment_confirmation',
  p_priority TEXT DEFAULT 'high'
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
    'customer_name', COALESCE(v_order_data.customer_name, v_order_data.customer_name, 'Valued Customer'),
    'customer_email', COALESCE(v_order_data.customer_email, v_order_data.customer_email),
    'order_number', v_order_data.order_number,
    'order_total', '₦' || v_order_data.total_amount::text,
    'payment_reference', v_order_data.payment_reference,
    'payment_method', COALESCE(v_order_data.payment_method, 'Online Payment'),
    'order_date', to_char(v_order_data.created_at, 'DD Mon YYYY'),
    'business_name', 'Starters Small Chops',
    'support_email', 'support@starterssmallchops.com'
  );
  
  -- Insert or get existing event (idempotent)
  INSERT INTO communication_events (
    event_type,
    recipient_email,
    template_key,
    variables,
    order_id,
    priority,
    status,
    created_at
  ) VALUES (
    'payment_confirmation',
    COALESCE(v_order_data.customer_email, v_order_data.customer_email),
    p_template_key,
    v_template_variables,
    p_order_id,
    p_priority,
    'queued',
    NOW()
  )
  ON CONFLICT (order_id, event_type) DO UPDATE SET
    template_key = EXCLUDED.template_key,
    variables = EXCLUDED.variables,
    priority = EXCLUDED.priority,
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
    'payment_confirmation_queued',
    'Email',
    'Payment confirmation email queued for order: ' || v_order_data.order_number,
    p_order_id,
    jsonb_build_object(
      'event_id', v_event_id,
      'recipient', COALESCE(v_order_data.customer_email, v_order_data.customer_email),
      'template_key', p_template_key
    )
  );
  
  RETURN v_event_id;
END;
$$;