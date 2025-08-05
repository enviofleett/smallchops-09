-- Fix create_order_with_items function to use correct column names
-- Replace fulfillment_type with order_type and fix guest_session_id type

DROP FUNCTION IF EXISTS create_order_with_items(text, text, text, jsonb, text, jsonb, uuid, text);

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
    v_sequence_num bigint;
BEGIN
    -- Generate sequence number and convert to text properly
    v_sequence_num := nextval('order_number_seq');
    v_order_number := 'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                      LPAD(v_sequence_num::text, 6, '0');
    
    RAISE LOG 'Creating order % for customer: %', v_order_number, p_customer_email;
    
    -- Validate required parameters
    IF p_customer_email IS NULL OR p_customer_email = '' THEN
        RAISE EXCEPTION 'Customer email is required' USING ERRCODE = 'P0001';
    END IF;
    
    IF p_order_items IS NULL OR jsonb_array_length(p_order_items) = 0 THEN
        RAISE EXCEPTION 'Order items are required' USING ERRCODE = 'P0001';
    END IF;
    
    BEGIN
        -- Calculate total from items
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
        LOOP
            v_total_amount := v_total_amount + 
                ((v_item->>'quantity')::numeric * (v_item->>'price')::numeric);
        END LOOP;
        
        -- Get or create customer
        INSERT INTO customers (email, name, phone, created_at)
        VALUES (p_customer_email, p_customer_name, p_customer_phone, NOW())
        ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            phone = COALESCE(EXCLUDED.phone, customers.phone),
            updated_at = NOW()
        RETURNING id INTO v_customer_id;
        
        RAISE LOG 'Customer processed: %', v_customer_id;
        
        -- Create order with correct column names
        INSERT INTO orders (
            customer_id,
            customer_email,
            customer_name,
            customer_phone,
            order_number,
            status,
            order_type,  -- Using order_type instead of fulfillment_type
            delivery_address,
            payment_method,
            payment_status,
            guest_session_id,  -- This will be cast to text
            total_amount,
            order_time,
            created_at
        ) VALUES (
            v_customer_id,
            p_customer_email,
            p_customer_name,
            p_customer_phone,
            v_order_number,
            'pending',
            p_fulfillment_type,  -- Maps to order_type column
            p_delivery_address,
            p_payment_method,
            'pending',
            p_guest_session_id::text,  -- Cast to text
            v_total_amount,
            NOW(),
            NOW()
        ) RETURNING id INTO v_order_id;
        
        RAISE LOG 'Order created: %', v_order_id;
        
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
                (v_item->>'price')::numeric,
                (v_item->>'quantity')::integer * (v_item->>'price')::numeric,
                NOW()
            );
        END LOOP;
        
        RAISE LOG 'Order items created for order: %', v_order_id;
        
        -- Return success response
        v_result := jsonb_build_object(
            'success', true,
            'order_id', v_order_id,
            'order_number', v_order_number,
            'customer_id', v_customer_id,
            'total_amount', v_total_amount,
            'fulfillment_type', p_fulfillment_type,
            'message', 'Order created successfully'
        );
        
        RAISE LOG 'Order creation completed: % (number: %)', v_order_id, v_order_number;
        RETURN v_result;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Order creation failed: % (SQLSTATE: %), Customer: %', 
            SQLERRM, SQLSTATE, p_customer_email;
        RAISE EXCEPTION 'Order creation failed: %', SQLERRM USING ERRCODE = 'P0001';
    END;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_order_with_items TO service_role;
GRANT EXECUTE ON FUNCTION create_order_with_items TO authenticated;