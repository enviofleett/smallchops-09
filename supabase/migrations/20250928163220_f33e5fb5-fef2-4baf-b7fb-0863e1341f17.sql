-- Create a simpler, more robust version of the RPC function
CREATE OR REPLACE FUNCTION public.get_comprehensive_order_fulfillment_simple(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_order RECORD;
    v_delivery_schedule RECORD;
    v_pickup_point RECORD;
    v_business_settings RECORD;
    v_order_items jsonb := '[]'::jsonb;
    v_result jsonb;
    v_address text := 'Address not available';
    v_special_instructions text := '';
    v_assigned_driver RECORD;
BEGIN
    -- Get order details
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Order not found', 'order_id', p_order_id);
    END IF;

    -- Get delivery schedule
    SELECT * INTO v_delivery_schedule FROM order_delivery_schedule WHERE order_id = p_order_id;

    -- Get pickup point if needed
    IF v_order.order_type = 'pickup' AND v_order.pickup_point_id IS NOT NULL THEN
        SELECT * INTO v_pickup_point FROM pickup_points WHERE id = v_order.pickup_point_id;
    END IF;

    -- Get business settings
    SELECT * INTO v_business_settings FROM business_settings ORDER BY updated_at DESC LIMIT 1;

    -- Get assigned driver safely
    IF v_order.assigned_rider_id IS NOT NULL THEN
        SELECT * INTO v_assigned_driver FROM drivers WHERE id = v_order.assigned_rider_id;
    END IF;

    -- Get order items - simplified
    BEGIN
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', oi.id,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'total_price', oi.total_price,
                'special_instructions', COALESCE(oi.special_instructions, ''),
                'product', jsonb_build_object(
                    'id', COALESCE(p.id, oi.product_id),
                    'name', COALESCE(p.name, 'Product'),
                    'price', COALESCE(p.price, 0),
                    'image_url', p.image_url
                )
            )
        ) INTO v_order_items
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = p_order_id;
    EXCEPTION WHEN OTHERS THEN
        v_order_items := '[]'::jsonb;
    END;

    -- Resolve address safely
    IF v_order.order_type = 'delivery' AND v_order.delivery_address IS NOT NULL THEN
        BEGIN
            v_address := (v_order.delivery_address::jsonb)->>'address_line_1';
            IF v_address IS NULL THEN
                v_address := v_order.delivery_address::text;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_address := 'Delivery address available';
        END;
    ELSIF v_order.order_type = 'pickup' AND v_pickup_point.address IS NOT NULL THEN
        v_address := v_pickup_point.address;
    END IF;

    -- Get special instructions
    IF v_delivery_schedule.special_instructions IS NOT NULL THEN
        v_special_instructions := v_delivery_schedule.special_instructions;
    ELSIF v_order.special_instructions IS NOT NULL THEN
        v_special_instructions := v_order.special_instructions;
    END IF;

    -- Build result
    v_result := jsonb_build_object(
        'order', row_to_json(v_order)::jsonb,
        'items', v_order_items,
        'delivery_schedule', CASE WHEN v_delivery_schedule.id IS NOT NULL THEN row_to_json(v_delivery_schedule)::jsonb ELSE NULL END,
        'pickup_point', CASE WHEN v_pickup_point.id IS NOT NULL THEN row_to_json(v_pickup_point)::jsonb ELSE NULL END,
        'assigned_agent', CASE WHEN v_assigned_driver.id IS NOT NULL THEN row_to_json(v_assigned_driver)::jsonb ELSE NULL END,
        'business_settings', CASE WHEN v_business_settings.id IS NOT NULL THEN row_to_json(v_business_settings)::jsonb ELSE '{}'::jsonb END,
        'fulfillment_info', jsonb_build_object(
            'type', v_order.order_type,
            'address', v_address,
            'special_instructions', v_special_instructions,
            'pickup_time', CASE WHEN v_order.pickup_time IS NOT NULL THEN to_char(v_order.pickup_time, 'YYYY-MM-DD HH24:MI') ELSE NULL END,
            'delivery_date', CASE WHEN v_delivery_schedule.delivery_date IS NOT NULL THEN to_char(v_delivery_schedule.delivery_date, 'YYYY-MM-DD') ELSE NULL END,
            'delivery_hours', CASE 
                WHEN v_delivery_schedule.delivery_time_start IS NOT NULL THEN
                    jsonb_build_object(
                        'start', v_delivery_schedule.delivery_time_start,
                        'end', COALESCE(v_delivery_schedule.delivery_time_end, ''),
                        'is_flexible', COALESCE(v_delivery_schedule.is_flexible, false)
                    )
                ELSE NULL
            END
        )
    );

    RETURN v_result;
END;
$function$;