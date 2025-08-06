-- Fix the create_order_with_items function to properly use customer_accounts table
-- This resolves the foreign key constraint violation

DROP FUNCTION IF EXISTS create_order_with_items(text, text, jsonb, text, text, jsonb, text, text, text, numeric, numeric);

CREATE OR REPLACE FUNCTION create_order_with_items(
  p_customer_email text,
  p_customer_name text,
  p_items jsonb,
  p_customer_phone text DEFAULT NULL,
  p_fulfillment_type text DEFAULT 'delivery',
  p_delivery_address jsonb DEFAULT NULL,
  p_guest_session_id text DEFAULT NULL,
  p_payment_method text DEFAULT 'paystack',
  p_delivery_zone_id text DEFAULT NULL,
  p_delivery_fee numeric DEFAULT 0,
  p_total_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_account_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_user_id uuid;
  v_item jsonb;
  v_result jsonb;
  v_calculated_total numeric := 0;
  v_sequence_num bigint;
  v_order_type order_type;
  v_delivery_zone_uuid uuid;
BEGIN
  -- Generate sequence number for order number
  SELECT COALESCE(MAX(extract(epoch from created_at)::integer), 0) + 1 
  FROM orders INTO v_sequence_num;
  
  v_order_number := 'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                    LPAD(v_sequence_num::text, 6, '0');
  
  -- Convert delivery zone ID from text to UUID if provided
  IF p_delivery_zone_id IS NOT NULL AND p_delivery_zone_id != '' THEN
    BEGIN
      v_delivery_zone_uuid := p_delivery_zone_id::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_delivery_zone_uuid := NULL;
      RAISE LOG 'Invalid delivery zone ID: %', p_delivery_zone_id;
    END;
  END IF;
  
  -- Convert text to enum with validation
  BEGIN
    v_order_type := p_fulfillment_type::order_type;
  EXCEPTION WHEN OTHERS THEN
    v_order_type := 'delivery'::order_type;
    RAISE LOG 'Invalid fulfillment type %, defaulting to delivery', p_fulfillment_type;
  END;
  
  RAISE LOG 'Creating order % for customer: %', v_order_number, p_customer_email;
  RAISE LOG 'Order items received (type: %): %', jsonb_typeof(p_items), p_items;
  RAISE LOG 'Parameters - delivery_zone_id: %, delivery_fee: %, total_amount: %', 
    p_delivery_zone_id, p_delivery_fee, p_total_amount;
  
  -- Validate parameters
  IF p_customer_email IS NULL OR p_customer_email = '' THEN
    RAISE EXCEPTION 'Customer email is required' USING ERRCODE = 'P0001';
  END IF;
  
  IF p_customer_name IS NULL OR p_customer_name = '' THEN
    RAISE EXCEPTION 'Customer name is required' USING ERRCODE = 'P0001';
  END IF;
  
  -- Validate JSONB is an array
  IF p_items IS NULL THEN
    RAISE EXCEPTION 'Order items are required' USING ERRCODE = 'P0001';
  END IF;
  
  IF jsonb_typeof(p_items) != 'array' THEN
    RAISE EXCEPTION 'Order items must be an array, received: %', jsonb_typeof(p_items) 
    USING ERRCODE = 'P0001';
  END IF;
  
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order items array cannot be empty' USING ERRCODE = 'P0001';
  END IF;
  
  BEGIN
    -- Calculate total from items if not provided
    v_calculated_total := COALESCE(p_total_amount, 0);
    
    IF v_calculated_total = 0 THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
      LOOP
        RAISE LOG 'Processing item: %', v_item;
        v_calculated_total := v_calculated_total + 
          ((v_item->>'quantity')::numeric * 
           COALESCE((v_item->>'unit_price')::numeric, (v_item->>'price')::numeric, 0));
      END LOOP;
    END IF;
    
    RAISE LOG 'Using total amount: %', v_calculated_total;
    
    -- ✅ FIX: Try to find existing customer_account by email (not customers table)
    SELECT ca.id, ca.user_id INTO v_customer_account_id, v_user_id
    FROM customer_accounts ca
    WHERE ca.email = p_customer_email
    LIMIT 1;
    
    -- ✅ FIX: If no customer_account found, create one in customer_accounts table
    IF v_customer_account_id IS NULL THEN
      INSERT INTO customer_accounts (
        name,
        email,
        phone,
        user_id,
        email_verified,
        created_at,
        updated_at
      ) VALUES (
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        NULL, -- user_id is NULL for guest checkouts
        false,
        NOW(),
        NOW()
      ) RETURNING id INTO v_customer_account_id;
      
      RAISE LOG 'Created new customer_account: %', v_customer_account_id;
    ELSE
      -- Update existing customer_account if needed
      UPDATE customer_accounts 
      SET 
        name = p_customer_name,
        phone = COALESCE(p_customer_phone, phone),
        updated_at = NOW()
      WHERE id = v_customer_account_id;
      
      RAISE LOG 'Updated existing customer_account: %', v_customer_account_id;
    END IF;
    
    -- ✅ FIX: Create order using customer_account_id (which satisfies the foreign key)
    INSERT INTO orders (
      customer_id, -- This now correctly references customer_accounts.id
      customer_email,
      customer_name,
      customer_phone,
      order_number,
      status,
      order_type,
      delivery_address,
      payment_method,
      guest_session_id,
      total_amount,
      delivery_fee,
      discount_amount,
      delivery_zone_id,
      created_at,
      updated_at
    ) VALUES (
      v_customer_account_id, -- ✅ Use customer_accounts.id
      p_customer_email,
      p_customer_name,
      p_customer_phone,
      v_order_number,
      'pending',
      v_order_type,
      p_delivery_address,
      p_payment_method,
      CASE 
        WHEN p_guest_session_id IS NOT NULL AND p_guest_session_id != '' 
        THEN p_guest_session_id::uuid 
        ELSE NULL 
      END,
      v_calculated_total,
      COALESCE(p_delivery_fee, 0),
      0,
      v_delivery_zone_uuid,
      NOW(),
      NOW()
    ) RETURNING id INTO v_order_id;
    
    RAISE LOG 'Created order: %', v_order_id;
    
    -- Insert order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      RAISE LOG 'Inserting item: %', v_item;
      
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
        COALESCE((v_item->>'unit_price')::numeric, (v_item->>'price')::numeric, 0),
        (v_item->>'quantity')::integer * COALESCE((v_item->>'unit_price')::numeric, (v_item->>'price')::numeric, 0),
        COALESCE((v_item->>'discount_amount')::numeric, 0),
        NOW()
      );
    END LOOP;
    
    -- Return success result
    v_result := jsonb_build_object(
      'success', true,
      'order_id', v_order_id,
      'order_number', v_order_number,
      'customer_id', v_customer_account_id,
      'message', 'Order created successfully'
    );
    
    RAISE LOG 'Order creation completed successfully: %', v_result;
    RETURN v_result;
    
  EXCEPTION
    WHEN foreign_key_violation THEN
      RAISE LOG 'Foreign key violation: %', SQLERRM;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Foreign key constraint violation',
        'message', 'Order creation failed: ' || SQLERRM
      );
      
    WHEN OTHERS THEN
      RAISE LOG 'Error in order creation: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Order creation failed',
        'message', 'Order creation failed: ' || SQLERRM
      );
  END;
END;
$$;