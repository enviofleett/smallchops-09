-- Fix order total mismatch by standardizing calculation logic between client and server
-- This addresses the P0001 error "Order total mismatch between server and client calculations"

-- Drop the existing function
DROP FUNCTION IF EXISTS public.create_order_with_items(uuid, text, jsonb, jsonb, uuid, uuid, uuid, text, numeric);

-- Create enhanced function with standardized calculation logic
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
    v_subtotal_cents bigint := 0;
    v_delivery_fee_cents bigint := 0;
    v_discount_cents bigint := 0;
    v_delivery_discount_cents bigint := 0;
    v_total_cents bigint;
    v_promotion record;
    v_order_number text;
    v_customer_email text;
    v_customer_name text;
    v_customer_phone text;
    v_item_total_cents bigint;
    v_calculation_log text := '';
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

    -- Calculate subtotal using integer arithmetic (cents) to match client
    v_calculation_log := v_calculation_log || 'Items calculation: ';
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Convert to cents and calculate item total
        v_item_total_cents := ROUND((v_item->>'unit_price')::numeric * 100) * (v_item->>'quantity')::integer;
        v_subtotal_cents := v_subtotal_cents + v_item_total_cents;
        
        v_calculation_log := v_calculation_log || format('[%s: %s * %s = %s cents] ', 
            v_item->>'product_name', 
            (v_item->>'unit_price')::numeric,
            (v_item->>'quantity')::integer,
            v_item_total_cents);
    END LOOP;
    v_calculation_log := v_calculation_log || format('Subtotal: %s cents. ', v_subtotal_cents);

    -- Get delivery fee if delivery order (convert to cents)
    IF p_fulfillment_type = 'delivery' AND p_delivery_zone_id IS NOT NULL THEN
        SELECT ROUND(COALESCE(base_fee, 0) * 100) INTO v_delivery_fee_cents
        FROM delivery_zones 
        WHERE id = p_delivery_zone_id AND is_active = true;
        
        v_calculation_log := v_calculation_log || format('Delivery fee: %s cents. ', v_delivery_fee_cents);
    END IF;

    -- Apply promotion code if provided (using standardized field names)
    IF p_promotion_code IS NOT NULL AND LENGTH(TRIM(p_promotion_code)) > 0 THEN
        -- Validate promotion code
        SELECT * INTO v_promotion
        FROM promotions 
        WHERE UPPER(code) = UPPER(TRIM(p_promotion_code))
          AND status = 'active'
          AND valid_from <= NOW()
          AND (valid_until IS NULL OR valid_until >= NOW());
        
        IF v_promotion.id IS NOT NULL THEN
            -- Check minimum order requirement (convert to cents for comparison)
            IF v_promotion.min_order_amount IS NULL OR v_subtotal_cents >= ROUND(v_promotion.min_order_amount * 100) THEN
                -- Calculate discount based on promotion type using integer arithmetic
                CASE v_promotion.type
                    WHEN 'percentage' THEN
                        -- Use 'value' field for percentage (standard promotion field)
                        v_discount_cents := ROUND((v_subtotal_cents * v_promotion.value) / 100);
                    WHEN 'fixed_amount' THEN
                        -- Use 'value' field for fixed amount
                        v_discount_cents := LEAST(ROUND(v_promotion.value * 100), v_subtotal_cents);
                    WHEN 'free_delivery' THEN
                        v_delivery_discount_cents := v_delivery_fee_cents;
                    ELSE
                        -- Default to percentage for safety
                        v_discount_cents := ROUND((v_subtotal_cents * v_promotion.value) / 100);
                END CASE;
                
                -- Ensure discounts don't exceed subtotal/delivery fee
                v_discount_cents := LEAST(v_discount_cents, v_subtotal_cents);
                v_delivery_discount_cents := LEAST(v_delivery_discount_cents, v_delivery_fee_cents);
                
                v_calculation_log := v_calculation_log || format('Promotion %s applied: discount=%s cents, delivery_discount=%s cents. ', 
                    p_promotion_code, v_discount_cents, v_delivery_discount_cents);
            ELSE
                v_calculation_log := v_calculation_log || format('Promotion %s not applied: min_order_amount %s not met. ', 
                    p_promotion_code, v_promotion.min_order_amount);
            END IF;
        ELSE
            v_calculation_log := v_calculation_log || format('Invalid promotion code: %s. ', p_promotion_code);
        END IF;
    END IF;

    -- Calculate final total in cents
    v_total_cents := v_subtotal_cents + v_delivery_fee_cents - v_discount_cents - v_delivery_discount_cents;
    v_calculation_log := v_calculation_log || format('Final total: %s cents (%s naira). ', v_total_cents, v_total_cents::numeric / 100);
    
    -- Enhanced client-server total validation with detailed logging
    IF p_client_total IS NOT NULL THEN
        DECLARE
            v_server_total_naira numeric := v_total_cents::numeric / 100;
            v_difference_naira numeric := ABS(v_server_total_naira - p_client_total);
            v_tolerance_naira numeric := 5.0; -- 5 naira tolerance
        BEGIN
            IF v_difference_naira > v_tolerance_naira THEN
                -- Log detailed calculation mismatch with full breakdown
                RAISE LOG 'CALCULATION MISMATCH - Server: %s naira (%s cents), Client: %s naira, Diff: %s naira, Tolerance: %s naira. Calculation log: %s', 
                    v_server_total_naira, v_total_cents, p_client_total, v_difference_naira, v_tolerance_naira, v_calculation_log;
                    
                RAISE EXCEPTION 'Order total mismatch between server and client calculations. Server: %, Client: %, Difference: %' 
                    USING ERRCODE = 'P0001', 
                    DETAIL = v_server_total_naira || ' vs ' || p_client_total || ' (diff: ' || v_difference_naira || ')';
            ELSIF v_difference_naira > 0.01 THEN
                -- Small discrepancy within tolerance: use server total but log for monitoring
                RAISE LOG 'Minor total discrepancy (%s naira) within tolerance - using server total: %s. Calculation log: %s', 
                    v_difference_naira, v_server_total_naira, v_calculation_log;
            ELSE
                -- Perfect match or negligible difference
                RAISE LOG 'Client-server calculation match: %s naira. Calculation log: %s', 
                    v_server_total_naira, v_calculation_log;
            END IF;
        END;
    ELSE
        -- No client total provided - log server calculation
        RAISE LOG 'Server-only calculation: %s naira (%s cents). Calculation log: %s', 
            v_total_cents::numeric / 100, v_total_cents, v_calculation_log;
    END IF;

    -- Generate unique order number
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(EXTRACT(EPOCH FROM NOW())::TEXT, 10, '0');

    -- Create order record (convert cents back to naira for storage)
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
        v_subtotal_cents::numeric / 100,
        v_delivery_fee_cents::numeric / 100,
        v_discount_cents::numeric / 100,
        v_delivery_discount_cents::numeric / 100,
        v_total_cents::numeric / 100,
        'pending'::order_status,
        'pending'::payment_status,
        p_promotion_code
    )
    RETURNING id INTO v_order_id;

    -- Insert order items (convert cents back to naira)
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
            (ROUND((v_item->>'unit_price')::numeric * 100) * (v_item->>'quantity')::integer)::numeric / 100,
            v_item->'customizations'
        );
    END LOOP;

    -- Update promotion usage if applied
    IF v_promotion.id IS NOT NULL AND (v_discount_cents > 0 OR v_delivery_discount_cents > 0) THEN
        UPDATE promotions 
        SET usage_count = COALESCE(usage_count, 0) + 1,
            last_used_at = NOW()
        WHERE id = v_promotion.id;
    END IF;

    -- Log successful order creation with enhanced debugging
    RAISE LOG 'Order created successfully: ID=%s, Total=%s naira (%s cents), Items=%s, Subtotal=%s naira, Delivery=%s naira, Discounts=%s naira', 
        v_order_id, v_total_cents::numeric / 100, v_total_cents, jsonb_array_length(p_items), 
        v_subtotal_cents::numeric / 100, v_delivery_fee_cents::numeric / 100, 
        (v_discount_cents + v_delivery_discount_cents)::numeric / 100;

    RETURN v_order_id;

EXCEPTION WHEN OTHERS THEN
    -- Enhanced error logging for debugging
    RAISE LOG 'Order creation failed: %s (SQLSTATE: %s), Customer: %s, Items: %s, Calculation log: %s', 
        SQLERRM, SQLSTATE, p_customer_id, jsonb_array_length(p_items), v_calculation_log;
    RAISE;
END;
$function$;