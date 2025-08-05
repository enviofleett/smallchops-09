-- Drop all existing conflicting versions of create_order_with_items function
DROP FUNCTION IF EXISTS public.create_order_with_items(
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text,
  p_order_items jsonb,
  p_total_amount numeric,
  p_fulfillment_type text,
  p_delivery_address jsonb,
  p_pickup_point_id uuid,
  p_delivery_fee numeric,
  p_delivery_zone_id uuid,
  p_guest_session_id uuid
);

DROP FUNCTION IF EXISTS public.create_order_with_items(
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text,
  p_order_items jsonb,
  p_total_amount numeric,
  p_fulfillment_type text,
  p_delivery_address jsonb,
  p_pickup_point_id uuid,
  p_delivery_fee numeric,
  p_delivery_zone_id uuid,
  p_guest_session_id text
);

-- Create single unified function with consistent UUID parameter type
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text,
  p_order_items jsonb,
  p_total_amount numeric,
  p_fulfillment_type text,
  p_delivery_address jsonb DEFAULT NULL,
  p_pickup_point_id uuid DEFAULT NULL,
  p_delivery_fee numeric DEFAULT 0,
  p_delivery_zone_id uuid DEFAULT NULL,
  p_guest_session_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid;
  v_customer_account_id uuid;
  v_order_number text;
  v_order_item jsonb;
  v_result jsonb;
BEGIN
  -- Find existing customer account by email
  SELECT ca.id INTO v_customer_account_id
  FROM public.customer_accounts ca
  JOIN auth.users u ON ca.user_id = u.id
  WHERE u.email = p_customer_email;
  
  -- Generate order number
  SELECT 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || 
         LPAD((SELECT COUNT(*) + 1 FROM public.orders WHERE DATE(order_time) = CURRENT_DATE)::text, 4, '0')
  INTO v_order_number;
  
  -- Create the order
  INSERT INTO public.orders (
    order_number,
    customer_id,
    customer_email,
    customer_name,
    customer_phone,
    total_amount,
    fulfillment_type,
    delivery_address,
    pickup_point_id,
    delivery_fee,
    delivery_zone_id,
    guest_session_id,
    status,
    payment_status,
    order_time
  ) VALUES (
    v_order_number,
    v_customer_account_id,
    p_customer_email,
    p_customer_name,
    p_customer_phone,
    p_total_amount,
    p_fulfillment_type,
    p_delivery_address,
    p_pickup_point_id,
    COALESCE(p_delivery_fee, 0),
    p_delivery_zone_id,
    p_guest_session_id,
    'pending',
    'pending',
    now()
  ) RETURNING id INTO v_order_id;
  
  -- Insert order items
  FOR v_order_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      v_order_id,
      (v_order_item->>'product_id')::uuid,
      (v_order_item->>'quantity')::integer,
      (v_order_item->>'unit_price')::numeric,
      (v_order_item->>'total_price')::numeric
    );
  END LOOP;
  
  -- Queue welcome email for new customer accounts (only if customer_account was created)
  IF v_customer_account_id IS NOT NULL THEN
    -- Check if this is a new customer (first order)
    IF (SELECT COUNT(*) FROM public.orders WHERE customer_id = v_customer_account_id) = 1 THEN
      INSERT INTO public.communication_events (
        event_type,
        recipient_email,
        template_variables,
        priority,
        status
      ) VALUES (
        'customer_welcome',
        p_customer_email,
        jsonb_build_object(
          'customer_name', p_customer_name,
          'order_number', v_order_number
        ),
        'high',
        'queued'
      );
    END IF;
  END IF;
  
  -- Queue order confirmation email
  INSERT INTO public.communication_events (
    event_type,
    recipient_email,
    order_id,
    template_variables,
    priority,
    status
  ) VALUES (
    'order_confirmation',
    p_customer_email,
    v_order_id,
    jsonb_build_object(
      'customer_name', p_customer_name,
      'order_number', v_order_number,
      'total_amount', p_total_amount,
      'fulfillment_type', p_fulfillment_type
    ),
    'high',
    'queued'
  );
  
  -- Log order creation
  INSERT INTO public.audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'order_created',
    'Order Management',
    'Order created successfully: ' || v_order_number,
    jsonb_build_object(
      'order_id', v_order_id,
      'order_number', v_order_number,
      'customer_email', p_customer_email,
      'total_amount', p_total_amount,
      'customer_account_linked', v_customer_account_id IS NOT NULL
    )
  );
  
  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'customer_account_id', v_customer_account_id,
    'message', 'Order created successfully'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    INSERT INTO public.audit_logs (
      action,
      category,
      message,
      new_values
    ) VALUES (
      'order_creation_failed',
      'Order Management',
      'Order creation failed: ' || SQLERRM,
      jsonb_build_object(
        'customer_email', p_customer_email,
        'total_amount', p_total_amount,
        'error', SQLERRM
      )
    );
    
    RAISE EXCEPTION 'Order creation failed: %', SQLERRM;
END;
$$;