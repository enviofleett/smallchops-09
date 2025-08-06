-- Fix create_order_with_items function to handle JSONB arrays properly
CREATE OR REPLACE FUNCTION public.create_order_with_items(
    p_customer_email text,
    p_customer_name text,
    p_items jsonb,
    p_customer_phone text DEFAULT ''::text,
    p_fulfillment_type text DEFAULT 'delivery'::text,
    p_delivery_address jsonb DEFAULT NULL::jsonb,
    p_guest_session_id text DEFAULT ''::text,
    p_payment_method text DEFAULT 'paystack'::text,
    p_delivery_zone_id text DEFAULT NULL::text,
    p_delivery_fee numeric DEFAULT 0,
    p_total_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_customer_id uuid;
    v_order_id uuid;
    v_order_number text;
    v_item jsonb;
    v_subtotal numeric := 0;
    v_existing_customer customers%ROWTYPE;
    v_sequence_num bigint;
    v_result jsonb;
BEGIN
    -- Enhanced logging for debugging
    RAISE LOG 'create_order_with_items called with:';
    RAISE LOG '  customer_email: %', p_customer_email;
    RAISE LOG '  customer_name: %', p_customer_name;
    RAISE LOG '  items: %', p_items;
    RAISE LOG '  items type: %', jsonb_typeof(p_items);
    RAISE LOG '  fulfillment_type: %', p_fulfillment_type;
    RAISE LOG '  payment_method: %', p_payment_method;
    RAISE LOG '  total_amount: %', p_total_amount;

    -- Validate required parameters
    IF p_customer_email IS NULL OR p_customer_email = '' THEN
        RAISE EXCEPTION 'Customer email is required' USING ERRCODE = 'P0001';
    END IF;
    
    IF p_customer_name IS NULL OR p_customer_name = '' THEN
        RAISE EXCEPTION 'Customer name is required' USING ERRCODE = 'P0001';
    END IF;
    
    -- CRITICAL FIX: Validate JSONB is an array before calling array functions
    IF p_items IS NULL THEN
        RAISE EXCEPTION 'Order items are required' USING ERRCODE = 'P0001';
    END IF;
    
    IF jsonb_typeof(p_items) != 'array' THEN
        RAISE EXCEPTION 'Order items must be an array, received type: %', jsonb_typeof(p_items) 
        USING ERRCODE = 'P0001';
    END IF;
    
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order items array cannot be empty' USING ERRCODE = 'P0001';
    END IF;

    RAISE LOG 'Validation passed - items array has % elements', jsonb_array_length(p_items);

    BEGIN
        -- Check if customer exists
        SELECT * INTO v_existing_customer FROM public.customers WHERE email = p_customer_email;
        
        IF FOUND THEN
            v_customer_id := v_existing_customer.id;
            RAISE LOG 'Found existing customer: %', v_customer_id;
            
            -- Update customer info if provided
            UPDATE public.customers 
            SET 
                name = COALESCE(p_customer_name, name),
                phone = CASE 
                    WHEN p_customer_phone IS NOT NULL AND p_customer_phone != '' 
                    THEN p_customer_phone 
                    ELSE phone 
                END,
                updated_at = NOW()
            WHERE id = v_customer_id;
        ELSE
            -- Create new customer
            INSERT INTO public.customers (email, name, phone, created_at, updated_at)
            VALUES (
                p_customer_email, 
                p_customer_name, 
                NULLIF(p_customer_phone, ''), 
                NOW(), 
                NOW()
            ) RETURNING id INTO v_customer_id;
            
            RAISE LOG 'Created new customer: %', v_customer_id;
        END IF;

        -- Generate order number
        SELECT COALESCE(MAX(extract(epoch from created_at)::integer), 0) + 1 
        INTO v_sequence_num
        FROM public.orders;
        
        v_order_number := 'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(v_sequence_num::text, 6, '0');
        
        RAISE LOG 'Generated order number: %', v_order_number;

        -- Calculate subtotal from items
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            RAISE LOG 'Processing item: %', v_item;
            
            -- Validate item structure
            IF NOT (v_item ? 'product_id' AND v_item ? 'quantity' AND v_item ? 'unit_price') THEN
                RAISE EXCEPTION 'Invalid item structure: %', v_item USING ERRCODE = 'P0001';
            END IF;
            
            v_subtotal := v_subtotal + ((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric);
        END LOOP;
        
        RAISE LOG 'Calculated subtotal: %', v_subtotal;

        -- Create order record
        INSERT INTO public.orders (
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
            order_time,
            created_at,
            updated_at
        ) VALUES (
            v_customer_id,
            p_customer_email,
            p_customer_name,
            NULLIF(p_customer_phone, ''),
            v_order_number,
            'pending'::order_status,
            CASE 
                WHEN p_fulfillment_type = 'pickup' THEN 'pickup'::order_type
                ELSE 'delivery'::order_type 
            END,
            p_delivery_address,
            p_payment_method,
            CASE 
                WHEN p_guest_session_id IS NOT NULL AND p_guest_session_id != '' 
                THEN p_guest_session_id::uuid 
                ELSE NULL 
            END,
            v_subtotal,
            COALESCE(p_delivery_fee, 0),
            CASE 
                WHEN p_total_amount > 0 THEN p_total_amount 
                ELSE v_subtotal + COALESCE(p_delivery_fee, 0) 
            END,
            NOW(),
            NOW(),
            NOW()
        ) RETURNING id INTO v_order_id;

        RAISE LOG 'Created order: %', v_order_id;

        -- Insert order items
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            INSERT INTO public.order_items (
                order_id,
                product_id,
                quantity,
                unit_price,
                discount_amount,
                total_price,
                created_at,
                updated_at
            ) VALUES (
                v_order_id,
                (v_item->>'product_id')::uuid,
                (v_item->>'quantity')::integer,
                (v_item->>'unit_price')::numeric,
                COALESCE((v_item->>'discount_amount')::numeric, 0),
                (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric,
                NOW(),
                NOW()
            );
        END LOOP;

        RAISE LOG 'Order items created successfully';

        -- Build success response
        v_result := jsonb_build_object(
            'success', true,
            'order_id', v_order_id,
            'order_number', v_order_number,
            'customer_id', v_customer_id,
            'subtotal', v_subtotal,
            'message', 'Order created successfully'
        );

        RAISE LOG 'Order creation completed successfully: %', v_result;
        
        RETURN v_result;

    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Order creation failed - Error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
        RAISE EXCEPTION 'Order creation failed: %', SQLERRM USING ERRCODE = 'P0001';
    END;
END;
$function$;