-- Fix customizations JSONB type error in create_order_with_items function
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
BEGIN
    -- Get customer details
    SELECT email, name, phone INTO v_customer_email, v_customer_name, v_customer_phone
    FROM customer_accounts 
    WHERE id = p_customer_id
    LIMIT 1;

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
    END IF;

    -- Calculate totals
    v_fulfillment_fee := COALESCE(v_delivery_fee, 0);
    v_tax_amount := (v_subtotal - v_promotion_discount) * (v_vat_rate / 100);
    v_total_amount := v_subtotal + v_tax_amount + v_fulfillment_fee - v_promotion_discount;

    -- Create order
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
        v_customer_name,
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

    -- Insert order items with FIXED customizations JSON handling
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

        INSERT INTO order_items (
            order_id,
            product_id,
            quantity,
            unit_price,
            total_price,
            customizations,
            created_at,
            updated_at
        ) VALUES (
            v_order_id,
            v_product_id,
            v_quantity,
            v_unit_price,
            v_item_total,
            v_item->'customizations',  -- FIXED: Use -> instead of ->> to preserve JSONB type
            NOW(),
            NOW()
        );
    END LOOP;

    -- Log successful order creation
    INSERT INTO audit_logs (action, category, message, entity_id, new_values)
    VALUES (
        'order_created_with_items',
        'Order Management',
        'Order created successfully with items',
        v_order_id,
        jsonb_build_object(
            'order_id', v_order_id,
            'order_number', v_order_number,
            'customer_id', p_customer_id,
            'total_amount', v_total_amount,
            'items_count', jsonb_array_length(p_items)
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'total_amount', v_total_amount
    );

EXCEPTION WHEN OTHERS THEN
    -- Log error
    INSERT INTO audit_logs (action, category, message, new_values)
    VALUES (
        'order_creation_failed',
        'Order Management Error',
        'Order creation failed: ' || SQLERRM,
        jsonb_build_object(
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'customer_id', p_customer_id,
            'fulfillment_type', p_fulfillment_type
        )
    );
    
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Order creation failed: ' || SQLERRM
    );
END;
$function$;