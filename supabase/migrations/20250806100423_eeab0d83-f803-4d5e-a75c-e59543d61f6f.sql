-- Fix the create_order_with_items function to handle customer lookup correctly
-- The issue is the function is creating a customer with email mismatch

CREATE OR REPLACE FUNCTION public.create_order_with_items(
    p_customer_email text,
    p_customer_name text,
    p_items jsonb,
    p_customer_phone text DEFAULT NULL::text,
    p_fulfillment_type text DEFAULT 'delivery'::text,
    p_delivery_address jsonb DEFAULT NULL::jsonb,
    p_guest_session_id text DEFAULT NULL::text,
    p_payment_method text DEFAULT 'paystack'::text,
    p_delivery_zone_id uuid DEFAULT NULL::uuid,
    p_delivery_fee numeric DEFAULT 0,
    p_total_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_order_id uuid;
    v_customer_id uuid;
    v_order_number text;
    v_item jsonb;
    v_result jsonb;
    v_subtotal numeric := 0;
    v_total_discount numeric := 0;
    v_sequence_num bigint;
    v_order_type order_type;
BEGIN
    -- Generate sequence number for order number
    v_sequence_num := nextval('order_number_seq');
    v_order_number := 'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                      LPAD(v_sequence_num::text, 6, '0');
    
    -- Convert fulfillment type to enum with validation
    BEGIN
        v_order_type := p_fulfillment_type::order_type;
    EXCEPTION WHEN OTHERS THEN
        v_order_type := 'delivery'::order_type;
        RAISE LOG 'Invalid fulfillment type %, defaulting to delivery', p_fulfillment_type;
    END;
    
    RAISE LOG 'Creating order % for customer: %', v_order_number, p_customer_email;
    
    -- Validate required parameters
    IF p_customer_email IS NULL OR p_customer_email = '' THEN
        RAISE EXCEPTION 'Customer email is required' USING ERRCODE = 'P0001';
    END IF;
    
    IF p_customer_name IS NULL OR p_customer_name = '' THEN
        RAISE EXCEPTION 'Customer name is required' USING ERRCODE = 'P0001';
    END IF;
    
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order items are required' USING ERRCODE = 'P0001';
    END IF;
    
    BEGIN
        -- Calculate subtotal and total discount from items
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_subtotal := v_subtotal + 
                (COALESCE((v_item->>'quantity')::numeric, 0) * COALESCE((v_item->>'unit_price')::numeric, 0));
            
            v_total_discount := v_total_discount + 
                COALESCE((v_item->>'discount_amount')::numeric, 0);
        END LOOP;
        
        RAISE LOG 'Calculated subtotal: %, total discount: %', v_subtotal, v_total_discount;
        
        -- **CRITICAL FIX**: Get or create customer in customers table with proper error handling
        -- First try to get existing customer
        SELECT id INTO v_customer_id
        FROM customers 
        WHERE email = p_customer_email;
        
        IF v_customer_id IS NULL THEN
            -- Customer doesn't exist, create new one
            INSERT INTO customers (email, name, phone, created_at, updated_at)
            VALUES (p_customer_email, p_customer_name, p_customer_phone, NOW(), NOW())
            RETURNING id INTO v_customer_id;
            
            RAISE LOG 'Created new customer with ID: %', v_customer_id;
        ELSE
            -- Customer exists, optionally update details
            UPDATE customers 
            SET name = p_customer_name,
                phone = COALESCE(p_customer_phone, phone),
                updated_at = NOW()
            WHERE id = v_customer_id;
            
            RAISE LOG 'Updated existing customer with ID: %', v_customer_id;
        END IF;
        
        -- **CRITICAL FIX**: Ensure customer_id is valid before creating order
        IF v_customer_id IS NULL THEN
            RAISE EXCEPTION 'Failed to create or retrieve customer' USING ERRCODE = 'P0002';
        END IF;
        
        -- Create the order with the correct customer_id
        INSERT INTO orders (
            customer_id,
            customer_email,
            customer_name,
            customer_phone,
            order_number,
            status,
            order_type,
            delivery_address,
            payment_method,
            guest_session_id,
            subtotal,
            delivery_fee,
            total_amount,
            discount_amount,
            delivery_zone_id,
            created_at,
            updated_at
        ) VALUES (
            v_customer_id,  -- **CRITICAL**: Use the valid customer_id
            p_customer_email,
            p_customer_name,
            p_customer_phone,
            v_order_number,
            'pending'::order_status,
            v_order_type,
            p_delivery_address,
            p_payment_method,
            p_guest_session_id,
            v_subtotal,
            COALESCE(p_delivery_fee, 0),
            COALESCE(p_total_amount, v_subtotal + COALESCE(p_delivery_fee, 0)),
            v_total_discount,
            p_delivery_zone_id,
            NOW(),
            NOW()
        ) RETURNING id INTO v_order_id;
        
        RAISE LOG 'Order created with ID: %, customer_id: %', v_order_id, v_customer_id;
        
        -- Insert order items with discount amounts
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
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
                COALESCE((v_item->>'unit_price')::numeric, 0),
                COALESCE((v_item->>'total_price')::numeric, 
                        (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric),
                COALESCE((v_item->>'discount_amount')::numeric, 0),
                NOW()
            );
        END LOOP;
        
        RAISE LOG 'Order items inserted for order: %', v_order_id;
        
        -- **CRITICAL**: Return success with proper order details including order_id
        v_result := jsonb_build_object(
            'success', true,
            'order_id', v_order_id,
            'order_number', v_order_number,
            'customer_id', v_customer_id,
            'subtotal', v_subtotal,
            'delivery_fee', COALESCE(p_delivery_fee, 0),
            'total_amount', COALESCE(p_total_amount, v_subtotal + COALESCE(p_delivery_fee, 0)),
            'discount_amount', v_total_discount,
            'order_type', v_order_type,
            'message', 'Order created successfully'
        );
        
        RAISE LOG 'Order created successfully: % (number: %)', v_order_id, v_order_number;
        RETURN v_result;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Order creation failed: % (SQLSTATE: %), Customer: %', 
            SQLERRM, SQLSTATE, p_customer_email;
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to create order',
            'sqlstate', SQLSTATE
        );
    END;
END;
$function$;