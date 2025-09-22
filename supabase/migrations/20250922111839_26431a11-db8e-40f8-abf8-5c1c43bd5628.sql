-- Phase 1: Drop existing overloaded create_order_with_items functions
DROP FUNCTION IF EXISTS public.create_order_with_items(
  p_customer_id uuid,
  p_fulfillment_type text,
  p_items jsonb,
  p_delivery_address jsonb,
  p_pickup_point_id uuid,
  p_delivery_zone_id uuid,
  p_guest_session_id text,
  p_promotion_code text,
  p_client_total numeric
);

DROP FUNCTION IF EXISTS public.create_order_with_items(
  p_customer_id uuid,
  p_fulfillment_type text,
  p_items jsonb,
  p_delivery_address jsonb,
  p_pickup_point_id uuid,
  p_delivery_zone_id uuid,
  p_guest_session_id uuid,
  p_promotion_code text,
  p_client_total numeric
);

-- Create unified function with consistent JSONB return type
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_customer_id uuid,
  p_fulfillment_type text,
  p_items jsonb,
  p_delivery_address jsonb DEFAULT NULL,
  p_pickup_point_id uuid DEFAULT NULL,
  p_delivery_zone_id uuid DEFAULT NULL,
  p_guest_session_id uuid DEFAULT NULL,
  p_promotion_code text DEFAULT NULL,
  p_client_total numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_total_amount numeric := 0;
  v_item jsonb;
  v_product_record record;
  v_item_total numeric;
BEGIN
  -- Input validation
  IF p_fulfillment_type IS NULL OR p_fulfillment_type = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Fulfillment type is required'
    );
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order must contain at least one item'
    );
  END IF;

  -- Validate delivery requirements
  IF p_fulfillment_type = 'delivery' AND (p_delivery_address IS NULL OR p_delivery_zone_id IS NULL) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery orders require address and delivery zone'
    );
  END IF;

  -- Validate pickup requirements
  IF p_fulfillment_type = 'pickup' AND p_pickup_point_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pickup orders require a pickup point'
    );
  END IF;

  -- Calculate total from items and validate products exist
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Validate required item fields
    IF NOT (v_item ? 'product_id' AND v_item ? 'quantity' AND v_item ? 'price') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid item format: missing product_id, quantity, or price'
      );
    END IF;

    -- Validate product exists
    SELECT * INTO v_product_record
    FROM products 
    WHERE id = (v_item->>'product_id')::uuid 
    AND is_available = true;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Product not found or unavailable: ' || (v_item->>'product_id')
      );
    END IF;

    -- Calculate item total
    v_item_total := (v_item->>'quantity')::numeric * (v_item->>'price')::numeric;
    v_total_amount := v_total_amount + v_item_total;
  END LOOP;

  -- Generate order number
  v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                    LPAD(NEXTVAL('order_number_seq')::text, 4, '0');

  -- Insert order
  INSERT INTO orders (
    customer_id,
    order_number,
    fulfillment_type,
    delivery_address,
    pickup_point_id,
    delivery_zone_id,
    guest_session_id,
    promotion_code,
    total_amount,
    status,
    created_at
  )
  VALUES (
    p_customer_id,
    v_order_number,
    p_fulfillment_type::fulfillment_type,
    p_delivery_address,
    p_pickup_point_id,
    p_delivery_zone_id,
    p_guest_session_id,
    p_promotion_code,
    v_total_amount,
    'pending'::order_status,
    NOW()
  )
  RETURNING id INTO v_order_id;

  -- Insert order items
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
  SELECT
    v_order_id,
    (item->>'product_id')::uuid,
    (item->>'quantity')::integer,
    (item->>'price')::numeric,
    (item->>'quantity')::numeric * (item->>'price')::numeric
  FROM jsonb_array_elements(p_items) AS item;

  -- Log order creation
  INSERT INTO audit_logs (action, category, message, entity_id, new_values)
  VALUES (
    'order_created_via_rpc',
    'Order Management',
    'Order created via create_order_with_items RPC',
    v_order_id,
    jsonb_build_object(
      'order_number', v_order_number,
      'fulfillment_type', p_fulfillment_type,
      'total_amount', v_total_amount,
      'item_count', jsonb_array_length(p_items)
    )
  );

  -- Return consistent success response
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total_amount
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'order_creation_failed_rpc',
    'Order Management Error',
    'Order creation failed via RPC: ' || SQLERRM,
    jsonb_build_object(
      'error', SQLERRM,
      'sqlstate', SQLSTATE,
      'fulfillment_type', p_fulfillment_type,
      'customer_id', p_customer_id
    )
  );

  RETURN jsonb_build_object(
    'success', false,
    'error', 'Failed to create order: ' || SQLERRM
  );
END;
$$;

-- Create sequence for order numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;