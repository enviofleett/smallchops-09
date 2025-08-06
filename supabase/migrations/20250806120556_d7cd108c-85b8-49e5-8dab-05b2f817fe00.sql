-- Drop existing function to avoid conflicts
DROP FUNCTION IF EXISTS public.create_order_with_items(text, text, jsonb, text, text, text, uuid, numeric, numeric);

-- Create new production-grade create_order_with_items function
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_customer_id uuid,
  p_fulfillment_type text,
  p_delivery_address jsonb DEFAULT NULL,
  p_pickup_point_id uuid DEFAULT NULL,
  p_delivery_zone_id uuid DEFAULT NULL,
  p_guest_session_id uuid DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_customer_record RECORD;
  v_pickup_point_record RECORD;
  v_item jsonb;
  v_total_amount numeric := 0;
  v_item_count integer := 0;
  v_product_record RECORD;
  v_item_total numeric;
BEGIN
  -- Input validation
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer ID is required';
  END IF;
  
  IF p_fulfillment_type IS NULL OR p_fulfillment_type NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'Invalid fulfillment type. Must be "delivery" or "pickup"';
  END IF;
  
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;
  
  RAISE NOTICE 'Starting order creation for customer: %', p_customer_id;
  
  -- Validate customer exists
  SELECT * INTO v_customer_record
  FROM customer_accounts
  WHERE id = p_customer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer with ID % not found', p_customer_id;
  END IF;
  
  RAISE NOTICE 'Customer found: % (%)', v_customer_record.name, v_customer_record.email;
  
  -- Validate pickup point if required
  IF p_fulfillment_type = 'pickup' THEN
    IF p_pickup_point_id IS NULL THEN
      RAISE EXCEPTION 'Pickup point ID is required for pickup orders';
    END IF;
    
    SELECT * INTO v_pickup_point_record
    FROM pickup_points
    WHERE id = p_pickup_point_id AND is_active = true;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Active pickup point with ID % not found', p_pickup_point_id;
    END IF;
    
    RAISE NOTICE 'Pickup point validated: %', v_pickup_point_record.name;
  END IF;
  
  -- Validate delivery requirements
  IF p_fulfillment_type = 'delivery' THEN
    IF p_delivery_address IS NULL THEN
      RAISE EXCEPTION 'Delivery address is required for delivery orders';
    END IF;
    
    IF p_delivery_zone_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM delivery_zones WHERE id = p_delivery_zone_id) THEN
        RAISE EXCEPTION 'Delivery zone with ID % not found', p_delivery_zone_id;
      END IF;
      RAISE NOTICE 'Delivery zone validated: %', p_delivery_zone_id;
    END IF;
  END IF;
  
  -- Validate and calculate items total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_count := v_item_count + 1;
    
    -- Validate required item fields
    IF NOT (v_item ? 'product_id' AND v_item ? 'quantity' AND v_item ? 'unit_price') THEN
      RAISE EXCEPTION 'Item % missing required fields (product_id, quantity, unit_price)', v_item_count;
    END IF;
    
    -- Validate product exists
    SELECT * INTO v_product_record
    FROM products
    WHERE id = (v_item->>'product_id')::uuid;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product with ID % not found', v_item->>'product_id';
    END IF;
    
    -- Calculate item total
    v_item_total := (v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric;
    v_total_amount := v_total_amount + v_item_total;
    
    RAISE NOTICE 'Item validated: % x % = %', v_product_record.name, (v_item->>'quantity')::integer, v_item_total;
  END LOOP;
  
  RAISE NOTICE 'Order validation complete. Total items: %, Total amount: %', v_item_count, v_total_amount;
  
  -- Generate unique order number
  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(floor(random() * 10000)::text, 4, '0');
  
  RAISE NOTICE 'Generated order number: %', v_order_number;
  
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
    guest_session_id,
    total_amount,
    payment_method,
    payment_status,
    status,
    order_time,
    created_at,
    updated_at
  ) VALUES (
    v_order_number,
    p_customer_id,
    v_customer_record.name,
    v_customer_record.email,
    v_customer_record.phone,
    p_fulfillment_type::order_type,
    p_delivery_address,
    p_pickup_point_id,
    p_delivery_zone_id,
    p_guest_session_id,
    v_total_amount,
    'pending'::payment_method,
    'pending'::payment_status,
    'pending'::order_status,
    now(),
    now(),
    now()
  ) RETURNING id INTO v_order_id;
  
  RAISE NOTICE 'Order created with ID: %', v_order_id;
  
  -- Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      total_price,
      discount_amount,
      created_at
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric,
      COALESCE((v_item->>'discount_amount')::numeric, 0),
      now()
    );
  END LOOP;
  
  RAISE NOTICE 'Order items inserted successfully for order: %', v_order_id;
  
  -- Log successful order creation
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'order_created_v2',
    'Order Management',
    'Order created successfully: ' || v_order_number,
    jsonb_build_object(
      'order_id', v_order_id,
      'order_number', v_order_number,
      'customer_id', p_customer_id,
      'fulfillment_type', p_fulfillment_type,
      'total_amount', v_total_amount,
      'item_count', v_item_count
    )
  );
  
  RETURN v_order_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO audit_logs (
      action,
      category,
      message,
      new_values
    ) VALUES (
      'order_creation_failed_v2',
      'Order Management',
      'Order creation failed: ' || SQLERRM,
      jsonb_build_object(
        'customer_id', p_customer_id,
        'fulfillment_type', p_fulfillment_type,
        'error', SQLERRM,
        'sqlstate', SQLSTATE
      )
    );
    
    -- Re-raise the exception
    RAISE;
END;
$$;