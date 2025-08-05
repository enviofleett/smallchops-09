-- Step 1: Drop ALL existing versions of the function to resolve overload conflict
DROP FUNCTION IF EXISTS create_order_with_items(text, text, jsonb, text, jsonb, text, text, uuid);
DROP FUNCTION IF EXISTS create_order_with_items(text, text, jsonb, text, text, jsonb, uuid, text);
DROP FUNCTION IF EXISTS create_order_with_items(text, text, text, jsonb, text, jsonb, uuid, text);

-- Step 2: Create ONE clean canonical version
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text DEFAULT NULL,
  p_order_items jsonb,
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
  -- Generate unique order number (fixes the NULL constraint issue)
  v_order_number := 'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                    LPAD(extract(epoch from NOW())::bigint % 1000000, 6, '0');
  
  RAISE LOG 'Creating order with number: % for customer: %', v_order_number, p_customer_email;
  
  -- Validate required parameters
  IF p_customer_email IS NULL OR p_customer_email = '' THEN
    RAISE EXCEPTION 'Customer email is required' USING ERRCODE = 'P0001';
  END IF;
  
  IF p_order_items IS NULL OR jsonb_array_length(p_order_items) = 0 THEN
    RAISE EXCEPTION 'Order items are required' USING ERRCODE = 'P0001';
  END IF;
  
  BEGIN
    -- Calculate total amount from order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
      v_total_amount := v_total_amount + (COALESCE((v_item->>'unit_price')::numeric, (v_item->>'price')::numeric, 0) * COALESCE((v_item->>'quantity')::integer, 1));
    END LOOP;
    
    RAISE LOG 'Calculated total amount: %', v_total_amount;
    
    -- Get or create customer
    INSERT INTO customers (email, name, phone, created_at)
    VALUES (p_customer_email, p_customer_name, p_customer_phone, NOW())
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      phone = COALESCE(EXCLUDED.phone, customers.phone),
      updated_at = NOW()
    RETURNING id INTO v_customer_id;
    
    RAISE LOG 'Customer processed: %', v_customer_id;
    
    -- Create order with order_number and total_amount
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
      payment_status,
      total_amount,
      guest_session_id,
      order_time,
      created_at
    ) VALUES (
      v_customer_id,
      p_customer_email,
      p_customer_name,
      p_customer_phone,
      v_order_number,
      'pending',
      p_fulfillment_type,
      p_delivery_address,
      p_payment_method,
      'pending',
      v_total_amount,
      p_guest_session_id,
      NOW(),
      NOW()
    ) RETURNING id INTO v_order_id;
    
    RAISE LOG 'Order created: % with total: %', v_order_id, v_total_amount;
    
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
        COALESCE((v_item->>'quantity')::integer, 1),
        COALESCE((v_item->>'unit_price')::numeric, (v_item->>'price')::numeric, 0),
        COALESCE((v_item->>'total_price')::numeric, (v_item->>'unit_price')::numeric * (v_item->>'quantity')::integer, (v_item->>'price')::numeric * (v_item->>'quantity')::integer, 0),
        NOW()
      );
    END LOOP;
    
    RAISE LOG 'Order items inserted for order: %', v_order_id;
    
    -- Return success with order_number
    v_result := jsonb_build_object(
      'success', true,
      'order_id', v_order_id,
      'order_number', v_order_number,
      'customer_id', v_customer_id,
      'total_amount', v_total_amount,
      'message', 'Order created successfully'
    );
    
    RAISE LOG 'Order creation completed successfully: % (number: %)', v_order_id, v_order_number;
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Order creation failed: % (SQLSTATE: %), Customer: %', SQLERRM, SQLSTATE, p_customer_email;
    RAISE EXCEPTION 'Order creation failed: %', SQLERRM USING ERRCODE = 'P0001';
  END;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_order_with_items TO service_role;
GRANT EXECUTE ON FUNCTION create_order_with_items TO authenticated;