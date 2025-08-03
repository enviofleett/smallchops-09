-- Update create_order_with_items function to handle guest session parameters
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_delivery_address text,
  p_delivery_zone_id uuid,
  p_payment_method text,
  p_order_items jsonb,
  p_total_amount numeric,
  p_guest_session_id text DEFAULT NULL,
  p_order_type text DEFAULT 'regular'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_result jsonb;
BEGIN
  -- Generate order number
  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || 
                    LPAD(nextval('order_number_seq')::text, 4, '0');
  
  -- Create the order with guest session support
  INSERT INTO orders (
    order_number,
    customer_name,
    customer_email,
    customer_phone,
    delivery_address,
    delivery_zone_id,
    payment_method,
    total_amount,
    status,
    payment_status,
    guest_session_id,
    order_type,
    order_time
  ) VALUES (
    v_order_number,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_delivery_address,
    p_delivery_zone_id,
    p_payment_method,
    p_total_amount,
    CASE 
      WHEN p_payment_method = 'cash_on_delivery' THEN 'confirmed'::order_status
      ELSE 'pending'::order_status
    END,
    CASE 
      WHEN p_payment_method = 'cash_on_delivery' THEN 'pending'::payment_status
      ELSE 'pending'::payment_status
    END,
    p_guest_session_id,
    p_order_type,
    now()
  ) RETURNING id INTO v_order_id;
  
  -- Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      total_price,
      product_name
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'total_price')::numeric,
      v_item->>'product_name'
    );
  END LOOP;
  
  -- Queue communication event for order confirmation
  INSERT INTO communication_events (
    order_id,
    event_type,
    status,
    recipient_email,
    payload
  ) VALUES (
    v_order_id,
    'order_confirmation',
    'queued'::communication_event_status,
    p_customer_email,
    jsonb_build_object(
      'order_number', v_order_number,
      'customer_name', p_customer_name,
      'total_amount', p_total_amount,
      'payment_method', p_payment_method,
      'is_guest_order', p_guest_session_id IS NOT NULL
    )
  );
  
  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'message', 'Order created successfully'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO audit_logs (
      action,
      category,
      message,
      new_values
    ) VALUES (
      'create_order_error',
      'Orders',
      'Error creating order: ' || SQLERRM,
      jsonb_build_object(
        'customer_email', p_customer_email,
        'guest_session_id', p_guest_session_id,
        'error', SQLERRM
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to create order'
    );
END;
$$;

-- Create sequence for order numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000;