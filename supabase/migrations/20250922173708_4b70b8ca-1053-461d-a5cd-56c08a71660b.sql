-- Fix the guest_session_id UUID constraint by handling ALL dependent views
-- Drop all dependent views in both schemas
DROP VIEW IF EXISTS app.orders_with_payment CASCADE;
DROP VIEW IF EXISTS private.orders_with_payment CASCADE;

-- Now update the orders table to allow text guest_session_id  
ALTER TABLE orders ALTER COLUMN guest_session_id TYPE TEXT;

-- Recreate the views with the updated column type
-- App schema view
CREATE OR REPLACE VIEW app.orders_with_payment AS
SELECT 
  o.*,
  pt.reference as payment_reference,
  pt.status as payment_transaction_status,
  pt.amount as payment_amount
FROM orders o
LEFT JOIN payment_transactions pt ON o.id = pt.order_id;

-- Private schema view (if it existed)
CREATE OR REPLACE VIEW private.orders_with_payment AS
SELECT 
  o.*,
  pt.reference as payment_reference,
  pt.status as payment_transaction_status,
  pt.amount as payment_amount
FROM orders o
LEFT JOIN payment_transactions pt ON o.id = pt.order_id;

-- Update the create_order_with_items function to handle text guest_session_id properly
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_customer_id uuid,
  p_fulfillment_type text, 
  p_items jsonb,
  p_delivery_address jsonb DEFAULT NULL,
  p_pickup_point_id uuid DEFAULT NULL,
  p_delivery_zone_id uuid DEFAULT NULL,
  p_guest_session_id text DEFAULT NULL,
  p_promotion_code text DEFAULT NULL,
  p_client_total numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Validate fulfillment type
  IF p_fulfillment_type NOT IN ('delivery', 'pickup') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid fulfillment type. Must be delivery or pickup'
    );  
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order must contain at least one item'
    );
  END IF;

  -- Calculate total and validate products
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Validate required item fields
    IF NOT (v_item ? 'product_id' AND v_item ? 'quantity' AND v_item ? 'price') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid item format: missing product_id, quantity, or price'
      );
    END IF;

    -- Use status column instead of is_available
    SELECT * INTO v_product_record
    FROM products 
    WHERE id = (v_item->>'product_id')::uuid 
    AND status = 'active';

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Product not found or unavailable: ' || (v_item->>'product_id')
      );
    END IF;

    v_item_total := (v_item->>'quantity')::numeric * (v_item->>'price')::numeric;
    v_total_amount := v_total_amount + v_item_total;
  END LOOP;

  -- Generate order number
  v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                    LPAD(NEXTVAL('order_number_seq')::text, 4, '0');

  -- Insert order with proper enum casting and text guest_session_id
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
    p_fulfillment_type::fulfillment_type,  -- Safe enum cast
    p_delivery_address,
    p_pickup_point_id,
    p_delivery_zone_id,
    p_guest_session_id,  -- Now accepts text directly
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

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Order creation failed: ' || SQLERRM
  );
END;
$$;