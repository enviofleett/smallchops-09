-- Hot fix: Create uniquely named function to avoid overloading ambiguity
CREATE OR REPLACE FUNCTION public.create_order_with_items_v2(
  p_customer_id uuid,
  p_fulfillment_type text,
  p_items jsonb,
  p_delivery_address jsonb DEFAULT NULL,
  p_pickup_point_id uuid DEFAULT NULL,
  p_delivery_zone_id uuid DEFAULT NULL,
  p_guest_session_id text DEFAULT NULL,  -- Explicitly TEXT to avoid ambiguity
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
  v_delivery_fee numeric := 0;
  v_vat_amount numeric := 0;
  v_final_total numeric;
  v_promotion_discount numeric := 0;
  v_promotion_record record;
BEGIN
  -- Generate order number
  v_order_number := 'ORD-' || UPPER(SUBSTR(gen_random_uuid()::text, 1, 8));
  
  -- Validate promotion code if provided
  IF p_promotion_code IS NOT NULL THEN
    SELECT * INTO v_promotion_record
    FROM promotions
    WHERE code = p_promotion_code
      AND (expires_at IS NULL OR expires_at > NOW())
      AND NOT expired;
    
    IF FOUND THEN
      v_promotion_discount := COALESCE(v_promotion_record.discount_amount, 0);
    END IF;
  END IF;
  
  -- Calculate item totals
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product_record
    FROM products
    WHERE id = (v_item->>'product_id')::uuid;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
    END IF;
    
    v_item_total := (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric;
    v_total_amount := v_total_amount + v_item_total;
  END LOOP;
  
  -- Calculate delivery fee if delivery
  IF p_fulfillment_type = 'delivery' AND p_delivery_zone_id IS NOT NULL THEN
    SELECT COALESCE(delivery_fee, 0) INTO v_delivery_fee
    FROM delivery_zones
    WHERE id = p_delivery_zone_id;
  END IF;
  
  -- Apply promotion discount
  v_total_amount := v_total_amount - v_promotion_discount;
  
  -- Add delivery fee
  v_total_amount := v_total_amount + v_delivery_fee;
  
  -- Calculate VAT (7.5%)
  v_vat_amount := v_total_amount * 0.075;
  v_final_total := v_total_amount + v_vat_amount;
  
  -- Use client total if provided, otherwise use calculated total
  IF p_client_total IS NOT NULL THEN
    v_final_total := p_client_total;
  END IF;
  
  -- Create order
  INSERT INTO orders (
    order_number,
    customer_id,
    customer_email,
    customer_name,
    customer_phone,
    fulfillment_type,
    status,
    total_amount,
    subtotal,
    delivery_fee,
    vat_amount,
    promotion_discount,
    delivery_address,
    pickup_point_id,
    delivery_zone_id,
    guest_session_id,
    promotion_code,
    created_at,
    updated_at
  )
  SELECT
    v_order_number,
    p_customer_id,
    c.email,
    c.name,
    c.phone,
    p_fulfillment_type,
    'pending'::order_status,
    v_final_total,
    v_total_amount - v_delivery_fee,
    v_delivery_fee,
    v_vat_amount,
    v_promotion_discount,
    p_delivery_address,
    p_pickup_point_id,
    p_delivery_zone_id,
    p_guest_session_id::text,  -- Explicit cast to text
    p_promotion_code,
    NOW(),
    NOW()
  FROM customers c
  WHERE c.id = p_customer_id
  RETURNING id INTO v_order_id;
  
  -- Create order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price,
      created_at
    )
    SELECT
      v_order_id,
      (v_item->>'product_id')::uuid,
      p.name,
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric,
      NOW()
    FROM products p
    WHERE p.id = (v_item->>'product_id')::uuid;
  END LOOP;
  
  -- Return order details
  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_final_total,
    'status', 'pending',
    'customer_id', p_customer_id
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Order creation failed: %', SQLERRM;
END;
$$;