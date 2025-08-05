-- Update create_order_with_items function to handle delivery_zone_id, delivery_fee, and total_amount
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_customer_email text,
  p_customer_name text,
  p_items jsonb,
  p_customer_phone text DEFAULT '',
  p_fulfillment_type text DEFAULT 'delivery',
  p_delivery_address jsonb DEFAULT NULL,
  p_guest_session_id text DEFAULT '',
  p_payment_method text DEFAULT 'cash_on_delivery',
  p_delivery_zone_id uuid DEFAULT NULL,
  p_delivery_fee numeric DEFAULT 0,
  p_total_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric := 0;
  v_total_vat numeric := 0;
  v_vat_rate numeric := 7.5; -- Default VAT rate
  v_item jsonb;
  v_item_subtotal numeric;
  v_item_vat numeric;
  v_product_price numeric;
  v_discount_amount numeric := 0;
  v_final_total numeric;
BEGIN
  -- Generate order ID and number
  v_order_id := gen_random_uuid();
  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || extract(epoch from now())::bigint;
  
  -- Calculate subtotal from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Get product price if not provided in item
    IF (v_item->>'unit_price') IS NULL THEN
      SELECT price INTO v_product_price
      FROM products 
      WHERE id = (v_item->>'product_id')::uuid;
    ELSE
      v_product_price := (v_item->>'unit_price')::numeric;
    END IF;
    
    -- Calculate item subtotal
    v_item_subtotal := v_product_price * (v_item->>'quantity')::integer;
    v_subtotal := v_subtotal + v_item_subtotal;
    
    -- Calculate VAT for this item
    v_item_vat := v_item_subtotal * (v_vat_rate / 100);
    v_total_vat := v_total_vat + v_item_vat;
    
    -- Insert order item
    INSERT INTO order_items (
      order_id, product_id, quantity, unit_price, total_price,
      discount_amount, vat_amount, created_at
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer,
      v_product_price,
      v_item_subtotal,
      0, -- No individual item discounts for now
      v_item_vat,
      now()
    );
  END LOOP;
  
  -- Use provided total_amount or calculate final total
  IF p_total_amount > 0 THEN
    v_final_total := p_total_amount;
  ELSE
    v_final_total := v_subtotal + p_delivery_fee;
  END IF;
  
  -- Create the order
  INSERT INTO orders (
    id,
    order_number,
    customer_email,
    customer_name,
    customer_phone,
    order_time,
    status,
    payment_status,
    payment_method,
    subtotal,
    total_vat,
    discount_amount,
    delivery_fee,
    total_amount,
    fulfillment_type,
    delivery_address,
    delivery_zone_id,
    guest_session_id,
    created_at,
    updated_at
  ) VALUES (
    v_order_id,
    v_order_number,
    p_customer_email,
    p_customer_name,
    p_customer_phone,
    now(),
    'pending',
    'pending',
    p_payment_method,
    v_subtotal,
    v_total_vat,
    v_discount_amount,
    p_delivery_fee,
    v_final_total,
    p_fulfillment_type,
    p_delivery_address,
    p_delivery_zone_id,
    p_guest_session_id,
    now(),
    now()
  );
  
  -- Log order creation
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'order_created',
    'Order Management',
    'Order created: ' || v_order_number,
    jsonb_build_object(
      'order_id', v_order_id,
      'order_number', v_order_number,
      'customer_email', p_customer_email,
      'subtotal', v_subtotal,
      'delivery_fee', p_delivery_fee,
      'total_amount', v_final_total,
      'fulfillment_type', p_fulfillment_type
    )
  );
  
  -- Return order details
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'delivery_fee', p_delivery_fee,
    'total_amount', v_final_total,
    'message', 'Order created successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO audit_logs (
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
        'error', SQLERRM,
        'sqlstate', SQLSTATE
      )
    );
    
    -- Return error
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to create order'
    );
END;
$$;