-- Fix the create_order_with_items function to properly set template_key
CREATE OR REPLACE FUNCTION public.create_order_with_items(p_customer_email text, p_customer_name text, p_customer_phone text, p_order_items jsonb, p_total_amount numeric, p_fulfillment_type text DEFAULT 'delivery'::text, p_delivery_address jsonb DEFAULT NULL::jsonb, p_pickup_point_id uuid DEFAULT NULL::uuid, p_delivery_fee numeric DEFAULT 0, p_delivery_zone_id uuid DEFAULT NULL::uuid, p_guest_session_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_customer_id UUID;
  v_item jsonb;
  v_product_record RECORD;
  v_result jsonb;
BEGIN
  -- Generate order number
  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(EXTRACT(EPOCH FROM now())::text, 10, '0');
  
  -- Try to find existing customer
  SELECT id INTO v_customer_id 
  FROM customers 
  WHERE email = p_customer_email;
  
  -- If customer doesn't exist, create one
  IF v_customer_id IS NULL THEN
    INSERT INTO customers (name, email, phone)
    VALUES (p_customer_name, p_customer_email, p_customer_phone)
    RETURNING id INTO v_customer_id;
  END IF;
  
  -- Validate pickup point if pickup order
  IF p_fulfillment_type = 'pickup' AND p_pickup_point_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pickup_points 
      WHERE id = p_pickup_point_id AND is_active = true
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'invalid_pickup_point',
        'message', 'Selected pickup point is not available'
      );
    END IF;
  END IF;
  
  -- Create the order
  INSERT INTO orders (
    order_number,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    order_type,
    delivery_address,
    pickup_point_id,
    delivery_zone_id,
    total_amount,
    delivery_fee,
    guest_session_id,
    status
  ) VALUES (
    v_order_number,
    v_customer_id,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_fulfillment_type::order_type,
    CASE WHEN p_fulfillment_type = 'delivery' THEN p_delivery_address::text ELSE NULL END,
    CASE WHEN p_fulfillment_type = 'pickup' THEN p_pickup_point_id ELSE NULL END,
    CASE WHEN p_fulfillment_type = 'delivery' THEN p_delivery_zone_id ELSE NULL END,
    p_total_amount,
    CASE WHEN p_fulfillment_type = 'delivery' THEN p_delivery_fee ELSE 0 END,
    p_guest_session_id,
    'pending'::order_status
  ) RETURNING id INTO v_order_id;
  
  -- Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    -- Get product details
    SELECT * INTO v_product_record
    FROM products
    WHERE id = (v_item->>'product_id')::uuid;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'product_not_found',
        'message', 'Product not found: ' || (v_item->>'product_id')
      );
    END IF;
    
    -- Insert order item
    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      v_product_record.name,
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'total_price')::numeric
    );
  END LOOP;

  -- Queue order confirmation email with proper template_key
  INSERT INTO communication_events (
    event_type,
    template_key,
    recipient_email,
    order_id,
    payload,
    status,
    priority
  ) VALUES (
    'order_confirmation',
    'order_confirmation_clean',
    p_customer_email,
    v_order_id,
    jsonb_build_object(
      'customer_name', p_customer_name,
      'order_number', v_order_number,
      'total_amount', p_total_amount,
      'fulfillment_type', p_fulfillment_type
    ),
    'queued'::communication_event_status,
    'high'
  );

  -- Queue admin notification email with proper template_key
  INSERT INTO communication_events (
    event_type,
    template_key,
    recipient_email,
    order_id,
    payload,
    status,
    priority
  ) VALUES (
    'admin_order_notification',
    'admin_order_notification_clean',
    COALESCE(
      (SELECT admin_notification_email FROM business_settings LIMIT 1),
      'admin@company.com'
    ),
    v_order_id,
    jsonb_build_object(
      'customer_name', p_customer_name,
      'customer_email', p_customer_email,
      'order_number', v_order_number,
      'total_amount', p_total_amount,
      'fulfillment_type', p_fulfillment_type
    ),
    'queued'::communication_event_status,
    'normal'
  );
  
  -- Log the operation
  INSERT INTO audit_logs (
    action,
    category,
    entity_type,
    entity_id,
    message,
    new_values
  ) VALUES (
    'order_created',
    'Order Management',
    'order',
    v_order_id,
    'Order created: ' || v_order_number || ' (Type: ' || p_fulfillment_type || ')',
    jsonb_build_object(
      'order_id', v_order_id,
      'order_number', v_order_number,
      'fulfillment_type', p_fulfillment_type,
      'customer_email', p_customer_email,
      'total_amount', p_total_amount,
      'pickup_point_id', p_pickup_point_id,
      'delivery_zone_id', p_delivery_zone_id
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'customer_id', v_customer_id,
    'fulfillment_type', p_fulfillment_type
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'database_error',
      'message', 'Database error: ' || SQLERRM
    );
END;
$function$;

-- Fix existing communication events with NULL template_key
UPDATE communication_events 
SET template_key = CASE 
  WHEN event_type = 'order_confirmation' THEN 'order_confirmation_clean'
  WHEN event_type = 'admin_order_notification' THEN 'admin_order_notification_clean'
  WHEN event_type = 'customer_welcome' THEN 'customer_welcome_clean'
  WHEN event_type = 'order_status_update' THEN 'order_status_update_clean'
  WHEN event_type = 'payment_confirmation' THEN 'payment_confirmation_clean'
  ELSE event_type
END
WHERE template_key IS NULL;