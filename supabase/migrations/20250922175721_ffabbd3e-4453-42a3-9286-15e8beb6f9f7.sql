-- Fix customer_name null constraint error in create_order_with_items function
-- Add proper error handling and fallback for customer data retrieval

CREATE OR REPLACE FUNCTION public.create_order_with_items(
    p_customer_id uuid,
    p_fulfillment_type text,
    p_items jsonb,
    p_delivery_address jsonb DEFAULT NULL,
    p_pickup_point_id uuid DEFAULT NULL,
    p_delivery_zone_id uuid DEFAULT NULL,
    p_guest_session_id uuid DEFAULT NULL,
    p_promotion_code text DEFAULT NULL,
    p_client_total numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_order_id uuid;
    v_order_number text;
    v_item jsonb;
    v_product_id uuid;
    v_quantity integer;
    v_unit_price numeric;
    v_product_price numeric;
    v_subtotal numeric := 0;
    v_tax_amount numeric := 0;
    v_delivery_fee numeric := 0;
    v_total_amount numeric := 0;
    v_customer_email text;
    v_customer_name text;
    v_customer_phone text;
    v_vat_rate numeric := 7.5;
    v_fulfillment_fee numeric := 0;
    v_item_total numeric;
    v_promotion_discount numeric := 0;
    v_promotion_id uuid;
    v_customer_found boolean := false;
BEGIN
    -- FIXED: Enhanced customer lookup with proper error handling and fallback
    RAISE LOG 'Order creation started for customer_id: %, fulfillment: %', p_customer_id, p_fulfillment_type;
    
    -- Validate customer_id parameter
    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer ID cannot be null' USING ERRCODE = 'P0001';
    END IF;
    
    -- Get customer details with explicit error handling
    BEGIN
        SELECT email, name, phone, true 
        INTO v_customer_email, v_customer_name, v_customer_phone, v_customer_found
        FROM customer_accounts 
        WHERE id = p_customer_id
        LIMIT 1;
        
        -- Check if customer was found
        IF NOT v_customer_found OR v_customer_email IS NULL THEN
            RAISE EXCEPTION 'Customer not found for ID: %', p_customer_id USING ERRCODE = 'P0002';
        END IF;
        
        -- CRITICAL: Ensure customer_name is never null (required by orders table constraint)
        IF v_customer_name IS NULL OR LENGTH(TRIM(v_customer_name)) = 0 THEN
            RAISE LOG 'Customer name is null/empty for ID %, using email prefix as fallback', p_customer_id;
            -- Extract name from email as fallback (e.g., "john.doe@example.com" -> "john.doe")
            v_customer_name := COALESCE(
                NULLIF(TRIM(split_part(v_customer_email, '@', 1)), ''),
                'Customer'  -- Ultimate fallback
            );
        END IF;
        
        RAISE LOG 'Customer lookup successful: email=%, name=%, phone=%', 
            v_customer_email, v_customer_name, COALESCE(v_customer_phone, 'NULL');
            
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Customer lookup failed for ID %: %', p_customer_id, SQLERRM 
            USING ERRCODE = 'P0003';
    END;

    -- Generate order number
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');

    -- Calculate subtotal from items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        
        -- Get product price
        SELECT price INTO v_product_price
        FROM products 
        WHERE id = v_product_id;
        
        v_unit_price := COALESCE(v_product_price, 0);
        v_item_total := v_unit_price * v_quantity;
        v_subtotal := v_subtotal + v_item_total;
    END LOOP;

    -- Apply promotion if provided
    IF p_promotion_code IS NOT NULL THEN
        SELECT id, discount_amount INTO v_promotion_id, v_promotion_discount
        FROM promotions 
        WHERE code = p_promotion_code 
        AND is_active = true 
        AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1;
        
        v_promotion_discount := COALESCE(v_promotion_discount, 0);
    END IF;

    -- Calculate delivery fee for delivery orders
    IF p_fulfillment_type = 'delivery' AND p_delivery_zone_id IS NOT NULL THEN
        SELECT base_fee INTO v_delivery_fee
        FROM delivery_zones 
        WHERE id = p_delivery_zone_id
        LIMIT 1;
        
        v_fulfillment_fee := COALESCE(v_delivery_fee, 0);
    END IF;

    -- Calculate tax (VAT)
    v_tax_amount := (v_subtotal * v_vat_rate) / 100;
    
    -- Calculate total
    v_total_amount := v_subtotal + v_tax_amount + v_fulfillment_fee - v_promotion_discount;

    -- FIXED: Enhanced order insertion with explicit validation
    RAISE LOG 'Inserting order: customer_name=%, total=%, items_count=%', 
        v_customer_name, v_total_amount, jsonb_array_length(p_items);
    
    -- Validate required fields before insertion
    IF LENGTH(TRIM(v_customer_name)) = 0 THEN
        RAISE EXCEPTION 'Customer name cannot be empty after fallback processing' 
            USING ERRCODE = 'P0004';
    END IF;
    
    INSERT INTO orders (
        customer_id,
        order_number,
        customer_email,
        customer_name,
        customer_phone,
        fulfillment_type,
        status,
        subtotal,
        tax_amount,
        delivery_fee,
        promotion_discount,
        total_amount,
        delivery_address,
        pickup_point_id,
        delivery_zone_id,
        guest_session_id,
        promotion_code,
        promotion_id,
        created_at,
        updated_at
    ) VALUES (
        p_customer_id,
        v_order_number,
        v_customer_email,
        v_customer_name,  -- This should never be null now
        v_customer_phone,
        p_fulfillment_type,
        'pending',
        v_subtotal,
        v_tax_amount,
        v_fulfillment_fee,
        v_promotion_discount,
        v_total_amount,
        p_delivery_address,
        p_pickup_point_id,
        p_delivery_zone_id,
        p_guest_session_id,
        p_promotion_code,
        v_promotion_id,
        NOW(),
        NOW()
    ) RETURNING id INTO v_order_id;

    RAISE LOG 'Order created successfully: order_id=%, order_number=%', v_order_id, v_order_number;

    -- Insert order items with proper customizations handling
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        
        -- Get product price for the item
        SELECT price INTO v_product_price
        FROM products 
        WHERE id = v_product_id;
        
        v_unit_price := COALESCE(v_product_price, 0);
        
        INSERT INTO order_items (
            order_id,
            product_id,
            quantity,
            unit_price,
            customizations,
            created_at
        ) VALUES (
            v_order_id,
            v_product_id,
            v_quantity,
            v_unit_price,
            CASE 
                WHEN v_item ? 'customizations' AND v_item->>'customizations' != 'null' 
                THEN (v_item->'customizations')
                ELSE NULL 
            END,
            NOW()
        );
    END LOOP;

    -- Return standardized result format
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'total_amount', v_total_amount,
        'customer_email', v_customer_email,
        'customer_name', v_customer_name
    );
    
EXCEPTION 
    WHEN OTHERS THEN
        RAISE LOG 'Order creation failed: SQLSTATE=%, SQLERRM=%', SQLSTATE, SQLERRM;
        
        -- Return standardized error format
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE,
            'customer_id', p_customer_id
        );
END;
$function$;