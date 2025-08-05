-- Fix order_number constraint violation by updating create_order_with_items function
-- Grant necessary permissions to sequence
GRANT USAGE ON SEQUENCE order_number_seq TO service_role;
GRANT USAGE ON SEQUENCE order_number_seq TO authenticated;

-- Update function to generate order numbers (fixed parameter order)
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_customer_email text,
  p_customer_name text,
  p_order_items jsonb,
  p_customer_phone text DEFAULT NULL,
  p_fulfillment_type text DEFAULT 'delivery',
  p_delivery_address jsonb DEFAULT NULL,
  p_guest_session_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'paystack'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id uuid;
  v_customer_id uuid;
  v_order_number text;
  v_item jsonb;
  v_result jsonb;
  v_total_amount numeric := 0;
BEGIN
  -- Generate unique order number
  v_order_number := 'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                    LPAD(nextval('order_number_seq')::text, 6, '0');
  
  RAISE LOG 'Creating order with number: %', v_order_number;
  
  -- Validate parameters
  IF p_customer_email IS NULL OR p_customer_email = '' THEN
    RAISE EXCEPTION 'Customer email is required' USING ERRCODE = 'P0001';
  END IF;
  
  IF p_order_items IS NULL OR jsonb_array_length(p_order_items) = 0 THEN
    RAISE EXCEPTION 'Order items are required' USING ERRCODE = 'P0001';
  END IF;

  -- Validate fulfillment type
  IF p_fulfillment_type NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'Invalid fulfillment type: %. Must be delivery or pickup', p_fulfillment_type USING ERRCODE = 'P0001';
  END IF;

  -- Calculate total amount from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    v_total_amount := v_total_amount + ((v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric);
  END LOOP;
  
  BEGIN
    -- Get or create customer
    INSERT INTO customers (email, name, phone, created_at)
    VALUES (p_customer_email, p_customer_name, p_customer_phone, NOW())
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      phone = COALESCE(EXCLUDED.phone, customers.phone),
      updated_at = NOW()
    RETURNING id INTO v_customer_id;
    
    RAISE LOG 'Customer ID: %', v_customer_id;
    
    -- Create order WITH order_number
    INSERT INTO orders (
      customer_id,
      customer_email,
      customer_name,
      customer_phone,
      order_number,
      status,
      fulfillment_type,
      delivery_address,
      payment_method,
      guest_session_id,
      total_amount,
      payment_status,
      order_time,
      created_at,
      updated_at
    ) VALUES (
      v_customer_id,
      p_customer_email,
      p_customer_name,
      p_customer_phone,
      v_order_number,
      'pending'::order_status,
      p_fulfillment_type::order_type,
      p_delivery_address,
      p_payment_method,
      p_guest_session_id,
      v_total_amount,
      'pending'::payment_status,
      NOW(),
      NOW(),
      NOW()
    ) RETURNING id INTO v_order_id;
    
    RAISE LOG 'Order created with ID: % and number: %', v_order_id, v_order_number;
    
    -- Insert order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
      INSERT INTO order_items (
        order_id,
        product_id,
        quantity,
        unit_price,
        total_price,
        created_at
      ) VALUES (
        v_order_id,
        (v_item->>'product_id')::uuid,
        (v_item->>'quantity')::integer,
        (v_item->>'unit_price')::numeric,
        (v_item->>'total_price')::numeric,
        NOW()
      );
    END LOOP;
    
    -- Return success with order number
    v_result := jsonb_build_object(
      'success', true,
      'order_id', v_order_id,
      'order_number', v_order_number,
      'customer_id', v_customer_id,
      'total_amount', v_total_amount,
      'message', 'Order created successfully'
    );
    
    RAISE LOG 'Order created successfully: % with number: %', v_order_id, v_order_number;
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Order creation failed: % (SQLSTATE: %), Customer: %', SQLERRM, SQLSTATE, p_customer_email;
    RAISE EXCEPTION 'Order creation failed: %', SQLERRM USING ERRCODE = 'P0001';
  END;
END;
$$;