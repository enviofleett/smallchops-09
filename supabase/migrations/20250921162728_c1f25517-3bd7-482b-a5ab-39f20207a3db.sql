-- Update create_order_with_items function to support promotion codes and discounts
DROP FUNCTION IF EXISTS public.create_order_with_items(uuid, text, jsonb, uuid, uuid, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.create_order_with_items(
    p_customer_id uuid,
    p_fulfillment_type text,
    p_delivery_address jsonb DEFAULT NULL,
    p_pickup_point_id uuid DEFAULT NULL,
    p_delivery_zone_id uuid DEFAULT NULL,
    p_guest_session_id uuid DEFAULT NULL,
    p_items jsonb,
    p_promotion_code text DEFAULT NULL,
    p_client_total numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
BEGIN
    -- Validate required parameters
    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer ID is required' USING ERRCODE = 'P0001';
    END IF;
    
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
            v_total_amount, p_client_total, ABS(v_total_amount - p_client_total);
        -- Use server calculation but log the mismatch for monitoring
    END IF;

    -- Generate order number
    v_order_number := 'ORD' || LPAD(EXTRACT(EPOCH FROM NOW())::text, 10, '0') || LPAD((RANDOM() * 999)::int::text, 3, '0');
        
    -- Create order
    INSERT INTO orders (
        customer_id,
        order_number,
        order_type,
        delivery_address,
        pickup_point_id,
        delivery_zone_id,
        subtotal_amount,
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
    
    -- Insert order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO order_items (
            order_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total_price,
            customizations,
            created_at
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::uuid,
            v_item->>'product_name',
            (v_item->>'quantity')::integer,
            (v_item->>'unit_price')::numeric,
            (v_item->>'unit_price')::numeric * (v_item->>'quantity')::integer,
            v_item->'customizations',
            NOW()
        );
    END LOOP;

    -- Track promotion usage if promotion was applied
    IF v_promotion.id IS NOT NULL AND (v_discount_amount > 0 OR v_delivery_discount > 0) THEN
        INSERT INTO promotion_usage (
            promotion_id,
            order_id,
            customer_id,
            discount_amount,
            delivery_discount,
            used_at
        ) VALUES (
            v_promotion.id,
            v_order_id,
            p_customer_id,
            v_discount_amount,
            v_delivery_discount,
            NOW()
        );
    END IF;
    
    RAISE LOG 'Order created: id=%, subtotal=%, delivery=%, discount=%, total=%', 
        v_order_id, v_subtotal, v_delivery_fee, (v_discount_amount + v_delivery_discount), v_total_amount;
    
    RETURN v_order_id;
    
EXCEPTION 
    WHEN OTHERS THEN
        RAISE LOG 'Order creation failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
        RAISE EXCEPTION 'Order creation failed: %', SQLERRM USING ERRCODE = 'P0001';
END;
$$;

-- Grant proper permissions
GRANT EXECUTE ON FUNCTION public.create_order_with_items TO service_role;
GRANT EXECUTE ON FUNCTION public.create_order_with_items TO authenticated;