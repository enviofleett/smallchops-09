-- Fix create_order_with_items function to use correct column names
CREATE OR REPLACE FUNCTION public.create_order_with_items(
    p_customer_name text,
    p_customer_email text,
    p_customer_phone text,
    p_customer_address text,
    p_delivery_instructions text,
    p_fulfillment_type text,
    p_payment_method text,
    p_subtotal numeric,
    p_vat_amount numeric,
    p_delivery_fee numeric,
    p_total_amount numeric,
    p_items jsonb,
    p_delivery_zone_id uuid DEFAULT NULL,
    p_scheduled_delivery_time timestamp with time zone DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_order_id uuid;
    v_order_number text;
    v_customer_id uuid;
    v_item jsonb;
    v_order_item_id uuid;
    v_validated_fulfillment_type order_type;
BEGIN
    -- Validate and convert fulfillment type
    IF p_fulfillment_type NOT IN ('delivery', 'pickup') THEN
        RAISE EXCEPTION 'Invalid fulfillment type: %. Must be delivery or pickup', p_fulfillment_type;
    END IF;
    
    v_validated_fulfillment_type := p_fulfillment_type::order_type;
    
    -- Generate order number
    v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || 
                     LPAD(nextval('order_number_seq')::text, 4, '0');

    -- Create or get customer
    INSERT INTO customers (name, email, phone, address)
    VALUES (p_customer_name, p_customer_email, p_customer_phone, p_customer_address)
    ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        updated_at = now()
    RETURNING id INTO v_customer_id;

    -- Create order with correct column names (removed non-existent columns)
    INSERT INTO orders (
        order_number,
        customer_id,
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        delivery_instructions,
        order_type,
        payment_method,
        subtotal,
        vat_amount,
        delivery_fee,
        total_amount,
        status,
        payment_status,
        delivery_zone_id,
        scheduled_delivery_time,
        created_at,
        updated_at
    ) VALUES (
        v_order_number,
        v_customer_id,
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        p_customer_address,
        p_delivery_instructions,
        v_validated_fulfillment_type,
        p_payment_method,
        p_subtotal,
        p_vat_amount,
        p_delivery_fee,
        p_total_amount,
        'pending'::order_status,
        'pending'::payment_status,
        p_delivery_zone_id,
        p_scheduled_delivery_time,
        now(),
        now()
    ) RETURNING id INTO v_order_id;

    -- Create order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO order_items (
            order_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total_price,
            special_instructions,
            created_at
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::uuid,
            v_item->>'product_name',
            (v_item->>'quantity')::integer,
            (v_item->>'unit_price')::numeric,
            (v_item->>'total_price')::numeric,
            v_item->>'special_instructions',
            now()
        ) RETURNING id INTO v_order_item_id;
    END LOOP;

    -- Return order details
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'customer_id', v_customer_id,
        'total_amount', p_total_amount,
        'status', 'pending'
    );

EXCEPTION WHEN OTHERS THEN
    -- Log the error and return failure
    RAISE WARNING 'Order creation failed: %', SQLERRM;
    
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE
    );
END;
$function$;