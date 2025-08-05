-- Fix create_order_with_items function to handle unit_price and prevent null subtotal
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_customer_email text,
  p_customer_name text,
  p_order_items jsonb,
  p_customer_phone text DEFAULT NULL,
  p_fulfillment_type order_type DEFAULT 'delivery',
  p_delivery_address jsonb DEFAULT NULL,
  p_guest_session_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'paystack'
)
RETURNS jsonb AS $$
DECLARE
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_item_record jsonb;
  v_product_record record;
  v_total_amount numeric := 0;
  v_item_total numeric;
  v_result jsonb;
BEGIN
  -- Enhanced parameter validation
  IF p_customer_email IS NULL OR LENGTH(TRIM(p_customer_email)) = 0 THEN
    RAISE EXCEPTION 'Customer email is required';
  END IF;
  
  IF p_customer_name IS NULL OR LENGTH(TRIM(p_customer_name)) = 0 THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;
  
  IF p_order_items IS NULL OR jsonb_array_length(p_order_items) = 0 THEN
    RAISE EXCEPTION 'Order items cannot be empty';
  END IF;

  -- Process customer
  SELECT id INTO v_customer_id
  FROM public.customer_accounts ca
  JOIN auth.users u ON ca.user_id = u.id
  WHERE u.email = p_customer_email;

  -- If no customer account found, create or find customer record
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (name, email, phone, created_at)
    VALUES (p_customer_name, p_customer_email, p_customer_phone, NOW())
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      phone = COALESCE(EXCLUDED.phone, customers.phone),
      updated_at = NOW()
    RETURNING id INTO v_customer_id;
    
    RAISE LOG 'Customer processed: %', v_customer_id;
  END IF;

  -- Generate order number
  v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');
  RAISE LOG 'Creating order % for customer: % with type: %', v_order_number, p_customer_email, p_fulfillment_type;

  -- Validate order items and calculate total
  FOR v_item_record IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    -- Validate required fields in order item
    IF NOT (v_item_record ? 'product_id') THEN
      RAISE EXCEPTION 'Order item missing product_id: %', v_item_record;
    END IF;
    
    IF NOT (v_item_record ? 'quantity') THEN
      RAISE EXCEPTION 'Order item missing quantity: %', v_item_record;
    END IF;
    
    IF NOT (v_item_record ? 'unit_price') THEN
      RAISE EXCEPTION 'Order item missing unit_price: %', v_item_record;
    END IF;

    -- Validate product exists
    SELECT id, name, price, status INTO v_product_record
    FROM public.products
    WHERE id = (v_item_record->>'product_id')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item_record->>'product_id';
    END IF;

    IF v_product_record.status != 'active' THEN
      RAISE EXCEPTION 'Product % is not active', v_product_record.name;
    END IF;

    -- Calculate item total using unit_price from the request
    v_item_total := (v_item_record->>'unit_price')::numeric * (v_item_record->>'quantity')::integer;
    v_total_amount := v_total_amount + v_item_total;
    
    RAISE LOG 'Item: % x% = % (running total: %)', 
      v_product_record.name, 
      v_item_record->>'quantity', 
      v_item_total, 
      v_total_amount;
  END LOOP;

  -- Ensure v_total_amount is never null or zero
  IF v_total_amount IS NULL OR v_total_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid total amount calculated: % (must be > 0)', v_total_amount;
  END IF;

  RAISE LOG 'Final calculated total: %', v_total_amount;

  -- Create the order with validated total
  INSERT INTO public.orders (
    customer_id,
    customer_email,
    customer_name,
    customer_phone,
    order_number,
    status,
    order_type,
    subtotal,
    delivery_fee,
    total_amount,
    delivery_address,
    guest_session_id,
    order_time,
    payment_method,
    payment_status
  ) VALUES (
    v_customer_id,
    p_customer_email,
    p_customer_name,
    p_customer_phone,
    v_order_number,
    'pending'::order_status,
    p_fulfillment_type,
    v_total_amount, -- Ensure this is never null
    0, -- Default delivery fee
    v_total_amount, -- Same as subtotal for now
    CASE WHEN p_fulfillment_type = 'delivery' THEN p_delivery_address ELSE NULL END,
    p_guest_session_id,
    NOW(),
    p_payment_method,
    'pending'
  ) RETURNING id INTO v_order_id;

  RAISE LOG 'Order created with ID: % and subtotal: %', v_order_id, v_total_amount;

  -- Insert order items
  FOR v_item_record IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    -- Get product details for order item
    SELECT name, price INTO v_product_record 
    FROM public.products 
    WHERE id = (v_item_record->>'product_id')::uuid;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      v_order_id,
      (v_item_record->>'product_id')::uuid,
      v_product_record.name,
      (v_item_record->>'quantity')::integer,
      (v_item_record->>'unit_price')::numeric,
      (v_item_record->>'unit_price')::numeric * (v_item_record->>'quantity')::integer
    );
  END LOOP;

  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'customer_id', v_customer_id,
    'total_amount', v_total_amount,
    'message', 'Order created successfully'
  );

  RAISE LOG 'Order creation completed successfully: %', v_result;
  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Order creation failed: % (SQLSTATE: %), Customer: %', SQLERRM, SQLSTATE, p_customer_email;
    RAISE EXCEPTION 'Order creation failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;