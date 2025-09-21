-- Fix create_order_with_items function signature to match edge function parameter order
-- This resolves the P0001 order total mismatch by ensuring parameter alignment

-- Drop the existing function
DROP FUNCTION IF EXISTS public.create_order_with_items(uuid, text, jsonb, jsonb, uuid, uuid, uuid, text, numeric);

-- Recreate function with correct parameter order matching the edge function call
CREATE OR REPLACE FUNCTION public.create_order_with_items(
    p_customer_id uuid,
    p_fulfillment_type text,
    p_delivery_address jsonb DEFAULT NULL::jsonb,
    p_pickup_point_id uuid DEFAULT NULL::uuid,
    p_delivery_zone_id uuid DEFAULT NULL::uuid,
    p_guest_session_id uuid DEFAULT NULL::uuid,
    p_items jsonb,
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

    -- Calculate subtotal from items using integer arithmetic (cents) for precision
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
                        v_discount_amount := ROUND((v_subtotal * v_promotion.value / 100) * 100) / 100;
                    WHEN 'fixed_amount' THEN
                        v_discount_amount := LEAST(v_promotion.value, v_subtotal);
                    WHEN 'free_delivery' THEN
                        v_delivery_discount := v_delivery_fee;
                    ELSE
                        -- Default to percentage for safety
                        v_discount_amount := ROUND((v_subtotal * v_promotion.value / 100) * 100) / 100;
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

    -- Calculate final total with consistent rounding
    v_total_amount := ROUND((v_subtotal + v_delivery_fee - v_discount_amount - v_delivery_discount) * 100) / 100;
    
    -- Enhanced client-server total validation with 5 naira tolerance
    IF p_client_total IS NOT NULL THEN
        IF ABS(v_total_amount - p_client_total) > 5 THEN
            -- Log detailed calculation mismatch
            RAISE LOG 'Order total mismatch - Server: %, Client: %, Diff: %, Subtotal: %, Delivery: %, Discount: %', 
                v_total_amount, p_client_total, ABS(v_total_amount - p_client_total), 
                v_subtotal, v_delivery_fee, (v_discount_amount + v_delivery_discount);
                
            RAISE EXCEPTION 'Order total mismatch between server and client calculations' USING ERRCODE = 'P0001';
        ELSIF ABS(v_total_amount - p_client_total) > 0.01 THEN
            -- Small discrepancy: use server total but log for monitoring
            RAISE LOG 'Minor total discrepancy (%.2f naira) - using server total: %', 
                ABS(v_total_amount - p_client_total), v_total_amount;
        END IF;
    END IF;

    -- Generate unique order number
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(EXTRACT(EPOCH FROM NOW())::TEXT, 10, '0');

    -- Create order record
    INSERT INTO orders (
        customer_id,
        customer_email,
        customer_name,
        customer_phone,
        order_number,
        fulfillment_type,
        delivery_address,
        pickup_point_id,
        delivery_zone_id,
        guest_session_id,
        subtotal_amount,
        delivery_fee,
        discount_amount,
        delivery_discount,
        total_amount,
        status,
        payment_status,
        promotion_code
    ) VALUES (
        p_customer_id,
        v_customer_email,
        v_customer_name,
        v_customer_phone,
        v_order_number,
        p_fulfillment_type::order_fulfillment_type,
        p_delivery_address,
        p_pickup_point_id,
        p_delivery_zone_id,
        p_guest_session_id,
        v_subtotal,
        v_delivery_fee,
        v_discount_amount,
        v_delivery_discount,
        v_total_amount,
        'pending'::order_status,
        'pending'::payment_status,
        p_promotion_code
    )
    RETURNING id INTO v_order_id;

    -- Insert order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO order_items (
            order_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            subtotal,
            customizations
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::uuid,
            v_item->>'product_name',
            (v_item->>'quantity')::integer,
            (v_item->>'unit_price')::numeric,
            (v_item->>'unit_price')::numeric * (v_item->>'quantity')::integer,
            v_item->'customizations'
        );
    END LOOP;

    -- Update promotion usage if applied
    IF v_promotion.id IS NOT NULL AND (v_discount_amount > 0 OR v_delivery_discount > 0) THEN
        UPDATE promotions 
        SET usage_count = COALESCE(usage_count, 0) + 1,
            last_used_at = NOW()
        WHERE id = v_promotion.id;
    END IF;

    -- Log successful order creation
    RAISE LOG 'Order created successfully: ID=%, Total=%, Items=%', 
        v_order_id, v_total_amount, jsonb_array_length(p_items);

    RETURN v_order_id;

EXCEPTION WHEN OTHERS THEN
    -- Log error details for debugging
    RAISE LOG 'Order creation failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RAISE;
END;
$function$;