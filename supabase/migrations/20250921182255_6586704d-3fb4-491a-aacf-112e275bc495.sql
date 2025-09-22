-- Fix create_order_with_items function to use correct column name 'subtotal' instead of 'subtotal_amount'
CREATE OR REPLACE FUNCTION public.create_order_with_items(
    p_customer_id uuid, 
    p_fulfillment_type text, 
    p_items jsonb, 
    p_delivery_address jsonb DEFAULT NULL::jsonb, 
    p_pickup_point_id uuid DEFAULT NULL::uuid, 
    p_delivery_zone_id uuid DEFAULT NULL::uuid, 
    p_guest_session_id uuid DEFAULT NULL::uuid, 
    p_promotion_code text DEFAULT NULL::text, 
    p_client_total numeric DEFAULT NULL::numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_order_id uuid;
    v_item jsonb;
    v_subtotal numeric := 0;
    v_delivery_fee numeric := 0;
    v_discount_amount numeric := 0;
    v_delivery_discount numeric := 0;
    v_total_amount numeric;
    v_promotion record;
    v_order_number text;
    v_customer_email text;
    v_customer_name text;
    v_customer_phone text;
BEGIN
    -- Get customer details
    SELECT ca.email, ca.name, ca.phone 
    INTO v_customer_email, v_customer_name, v_customer_phone
    FROM customer_accounts ca
    WHERE ca.id = p_customer_id;
    
    IF v_customer_email IS NULL THEN
        RAISE EXCEPTION 'Customer not found' USING ERRCODE = 'P0001';
    END IF;
    
    -- Validate required parameters
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order items are required' USING ERRCODE = 'P0001';
    END IF;
    
    -- Validate fulfillment_type
    IF p_fulfillment_type NOT IN ('delivery', 'pickup') THEN
        RAISE EXCEPTION 'Invalid fulfillment type. Must be delivery or pickup' USING ERRCODE = 'P0001';
    END IF;

    -- Calculate subtotal from items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_subtotal := v_subtotal + ((v_item->>'unit_price')::numeric * (v_item->>'quantity')::integer);
    END LOOP;

    -- Get delivery fee if delivery order
    IF p_fulfillment_type = 'delivery' AND p_delivery_zone_id IS NOT NULL THEN
        SELECT COALESCE(base_fee, 0) INTO v_delivery_fee
        FROM delivery_zones 
        WHERE id = p_delivery_zone_id AND is_active = true;
    END IF;

    -- Apply promotion code if provided
    IF p_promotion_code IS NOT NULL AND LENGTH(TRIM(p_promotion_code)) > 0 THEN
        -- Validate promotion code
        SELECT * INTO v_promotion
        FROM promotions 
        WHERE UPPER(code) = UPPER(TRIM(p_promotion_code))
          AND status = 'active'
          AND valid_from <= NOW()
          AND (valid_until IS NULL OR valid_until >= NOW());
        
        IF v_promotion.id IS NOT NULL THEN
            -- Check minimum order requirement
            IF v_promotion.min_order_amount IS NULL OR v_subtotal >= v_promotion.min_order_amount THEN
                -- Calculate discount based on promotion type
                CASE v_promotion.type
                    WHEN 'percentage' THEN
                        v_discount_amount := (v_subtotal * v_promotion.value / 100);
                    WHEN 'fixed_amount' THEN
                        v_discount_amount := LEAST(v_promotion.value, v_subtotal);
                    WHEN 'free_delivery' THEN
                        v_delivery_discount := v_delivery_fee;
                    ELSE
                        -- Default to percentage for safety
                        v_discount_amount := (v_subtotal * v_promotion.value / 100);
                END CASE;
                
                -- Ensure discounts don't exceed subtotal/delivery fee
                v_discount_amount := LEAST(v_discount_amount, v_subtotal);
                v_delivery_discount := LEAST(v_delivery_discount, v_delivery_fee);
                
                RAISE LOG 'Applied promotion %: discount=%, delivery_discount=%', 
                    p_promotion_code, v_discount_amount, v_delivery_discount;
            ELSE
                RAISE LOG 'Promotion % not applied: min_order_amount % not met (subtotal: %)', 
                    p_promotion_code, v_promotion.min_order_amount, v_subtotal;
            END IF;
        ELSE
            RAISE LOG 'Invalid promotion code: %', p_promotion_code;
        END IF;
    END IF;

    -- Calculate final total
    v_total_amount := v_subtotal + v_delivery_fee - v_discount_amount - v_delivery_discount;
    
    -- Validate against client total if provided (within ±1 naira tolerance for rounding)
    IF p_client_total IS NOT NULL AND ABS(v_total_amount - p_client_total) > 1 THEN
        RAISE LOG 'Total mismatch: server=%, client=%, diff=%', 
            v_total_amount, p_client_total, (v_total_amount - p_client_total);
        RAISE EXCEPTION 'Order total mismatch between server and client calculations' USING ERRCODE = 'P0001';
    END IF;
    
    -- Generate unique order number
    v_order_number := 'ORD' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(nextval('order_number_seq')::text, 6, '0');
    
    -- Create the order with corrected column name
    INSERT INTO orders (
        customer_id,
        customer_email,
        customer_name,
        customer_phone,
        order_number,
        order_type,
        delivery_address,
        pickup_point_id,
        delivery_zone_id,
        subtotal,              -- FIXED: Changed from subtotal_amount to subtotal
        delivery_fee,
        discount_amount,
        delivery_discount,
        total_amount,
        promotion_code,
        status,
        payment_status,
        payment_method,
        guest_session_id,
        created_at,
        updated_at
    ) VALUES (
        p_customer_id,
        v_customer_email,
        v_customer_name,
        v_customer_phone,
        v_order_number,
        p_fulfillment_type,
        p_delivery_address,
        p_pickup_point_id,
        p_delivery_zone_id,
        v_subtotal,
        v_delivery_fee,
        v_discount_amount,
        v_delivery_discount,
        v_total_amount,
        p_promotion_code,
        'pending',
        'pending',
        'paystack',
        p_guest_session_id,
        NOW(),
        NOW()
    ) RETURNING id INTO v_order_id;
    
    -- Create order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO order_items (
            order_id,
            product_id,
            product_name,
            price,
            quantity,
            customizations
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::uuid,
            v_item->>'product_name',
            (v_item->>'unit_price')::numeric,
            (v_item->>'quantity')::integer,
            COALESCE(v_item->'customizations', '[]'::jsonb)
        );
    END LOOP;
    
    -- Log successful order creation
    RAISE LOG 'Order created successfully: id=%, number=%', v_order_id, v_order_number;
    
    RETURN v_order_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Order creation failed: %', SQLERRM;
    RAISE EXCEPTION 'Order creation failed: %', SQLERRM USING ERRCODE = 'P0001';
END;
$function$;