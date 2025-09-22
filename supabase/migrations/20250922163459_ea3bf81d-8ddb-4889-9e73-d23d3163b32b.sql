-- Fix the create_order_with_items function to use 'status' instead of 'is_available'
-- First let's check the current function definition to see where the error is

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
SET search_path = public
AS $function$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_promotion_discount numeric := 0;
  v_total_amount numeric := 0;
  v_item jsonb;
  v_product_price numeric;
  v_product_name text;
  v_item_total numeric;
  v_promotion_id uuid;
  v_promotion_data jsonb;
  v_customer_data record;
BEGIN
  -- Get customer information
  SELECT name, email INTO v_customer_data
  FROM customer_accounts 
  WHERE id = p_customer_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Customer not found'
    );
  END IF;

  -- Generate order number
  v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                    LPAD(FLOOR(RANDOM() * 999999 + 1)::text, 6, '0');

  -- Calculate subtotal and validate items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Get product info and validate availability using 'status' column
    SELECT 
      COALESCE((v_item->>'price')::numeric, price) as price,
      name
    INTO v_product_price, v_product_name
    FROM products 
    WHERE id = (v_item->>'product_id')::uuid
      AND status = 'active'  -- Use status column instead of is_available
      AND NOT archived;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Product not found or unavailable: ' || COALESCE(v_item->>'product_id', 'unknown')
      );
    END IF;
    
    v_item_total := v_product_price * (v_item->>'quantity')::numeric;
    v_subtotal := v_subtotal + v_item_total;
  END LOOP;

  -- Calculate delivery fee if needed
  IF p_fulfillment_type = 'delivery' AND p_delivery_zone_id IS NOT NULL THEN
    SELECT COALESCE(base_fee, 0) INTO v_delivery_fee
    FROM delivery_zones
    WHERE id = p_delivery_zone_id AND is_active = true;
    
    v_delivery_fee := COALESCE(v_delivery_fee, 0);
  END IF;

  -- Validate and apply promotion if provided
  IF p_promotion_code IS NOT NULL THEN
    SELECT id, 
           jsonb_build_object(
             'type', type,
             'value', value,
             'min_order_amount', min_order_amount
           )
    INTO v_promotion_id, v_promotion_data
    FROM promotions 
    WHERE UPPER(code) = UPPER(p_promotion_code)
      AND status = 'active'
      AND (valid_from IS NULL OR valid_from <= NOW())
      AND (valid_until IS NULL OR valid_until >= NOW());
    
    IF FOUND THEN
      -- Check minimum order amount
      IF (v_promotion_data->>'min_order_amount')::numeric <= v_subtotal THEN
        CASE v_promotion_data->>'type'
          WHEN 'percentage' THEN
            v_promotion_discount := v_subtotal * (v_promotion_data->>'value')::numeric / 100;
          WHEN 'fixed_amount' THEN
            v_promotion_discount := LEAST(v_subtotal, (v_promotion_data->>'value')::numeric);
          ELSE
            v_promotion_discount := 0;
        END CASE;
      END IF;
    END IF;
  END IF;

  -- Calculate final total
  v_total_amount := v_subtotal + v_delivery_fee - v_promotion_discount;
  
  -- Ensure total is not negative
  v_total_amount := GREATEST(v_total_amount, 0);

  -- Create the order
  INSERT INTO orders (
    id,
    order_number,
    customer_id,
    customer_name,
    customer_email,
    subtotal,
    delivery_fee,
    promotion_discount,
    total_amount,
    fulfillment_type,
    delivery_address,
    pickup_point_id,
    delivery_zone_id,
    guest_session_id,
    promotion_code,
    promotion_id,
    status,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_order_number,
    p_customer_id,
    v_customer_data.name,
    v_customer_data.email,
    v_subtotal,
    v_delivery_fee,
    v_promotion_discount,
    v_total_amount,
    p_fulfillment_type::fulfillment_type,
    p_delivery_address,
    p_pickup_point_id,
    p_delivery_zone_id,
    p_guest_session_id,
    p_promotion_code,
    v_promotion_id,
    'pending'::order_status,
    NOW(),
    NOW()
  ) RETURNING id, order_number INTO v_order_id, v_order_number;

  -- Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT price, name INTO v_product_price, v_product_name
    FROM products 
    WHERE id = (v_item->>'product_id')::uuid;
    
    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      customizations
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      v_product_name,
      (v_item->>'quantity')::numeric,
      v_product_price,
      v_item->'customizations'
    );
  END LOOP;

  -- Track promotion usage if applied
  IF v_promotion_id IS NOT NULL AND v_promotion_discount > 0 THEN
    INSERT INTO promotion_usage (
      promotion_id,
      order_id,
      customer_email,
      discount_amount,
      used_at
    ) VALUES (
      v_promotion_id,
      v_order_id,
      v_customer_data.email,
      v_promotion_discount,
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'promotion_discount', v_promotion_discount,
    'total_amount', v_total_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Failed to create order: ' || SQLERRM
  );
END;
$function$;