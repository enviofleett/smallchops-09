-- Fix the comprehensive order fulfillment function - remove non-existent subtotal column reference
CREATE OR REPLACE FUNCTION public.get_comprehensive_order_fulfillment(p_order_id uuid)
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
    v_order_items jsonb;
    v_result jsonb;
BEGIN
    -- Get order details
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Order not found');
    END IF;

    -- Get delivery schedule
    SELECT * INTO v_delivery_schedule
    FROM order_delivery_schedule
    WHERE order_id = p_order_id;

    -- Get pickup point if order is pickup type
    IF v_order.order_type = 'pickup' AND v_order.pickup_point_id IS NOT NULL THEN
        SELECT * INTO v_pickup_point
        FROM pickup_points
        WHERE id = v_order.pickup_point_id;
    END IF;

    -- Get business settings (for pickup address fallback)
    SELECT * INTO v_business_settings
    FROM business_settings
    ORDER BY updated_at DESC
    LIMIT 1;

    -- Get order items with product details (FIXED: removed subtotal reference)
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', oi.id,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price,
            'special_instructions', oi.special_instructions,
            'product', jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'description', p.description,
                'price', p.price,
                'image_url', p.image_url,
                'category_id', p.category_id,
                'features', p.features,
                'ingredients', p.ingredients,
                'images', CASE WHEN p.image_url IS NOT NULL THEN jsonb_build_array(p.image_url) ELSE '[]'::jsonb END
            )
        )
    ) INTO v_order_items
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = p_order_id;

    -- Build comprehensive result with pickup-specific logic
    v_result := jsonb_build_object(
        'order', to_jsonb(v_order),
        'items', COALESCE(v_order_items, '[]'::jsonb),
        'delivery_schedule', CASE 
            WHEN v_delivery_schedule.id IS NOT NULL THEN to_jsonb(v_delivery_schedule)
            ELSE NULL
        END,
        'pickup_point', CASE 
            WHEN v_pickup_point.id IS NOT NULL THEN to_jsonb(v_pickup_point)
            ELSE NULL
        END,
        'business_settings', to_jsonb(v_business_settings),
        'fulfillment_info', jsonb_build_object(
            'type', v_order.order_type,
            'booking_window', CASE 
                WHEN v_order.order_type = 'pickup' AND v_order.pickup_time IS NOT NULL THEN v_order.pickup_time
                WHEN v_delivery_schedule.delivery_date IS NOT NULL THEN v_delivery_schedule.delivery_date
                ELSE NULL
            END,
            'delivery_hours', CASE 
                WHEN v_delivery_schedule.delivery_time_start IS NOT NULL AND v_delivery_schedule.delivery_time_end IS NOT NULL THEN
                    jsonb_build_object(
                        'start', v_delivery_schedule.delivery_time_start,
                        'end', v_delivery_schedule.delivery_time_end,
                        'is_flexible', COALESCE(v_delivery_schedule.is_flexible, false)
                    )
                ELSE NULL
            END,
            'address', CASE 
                WHEN v_order.order_type = 'delivery' THEN 
                    CASE 
                        WHEN v_order.delivery_address IS NOT NULL THEN 
                            COALESCE(
                                v_order.delivery_address->>'address'->>'address_line_1',
                                v_order.delivery_address::text
                            )
                        ELSE 'Delivery address not available'
                    END
                WHEN v_order.order_type = 'pickup' AND v_pickup_point.address IS NOT NULL THEN v_pickup_point.address
                WHEN v_order.order_type = 'pickup' AND v_business_settings.name IS NOT NULL THEN 
                    CONCAT(v_business_settings.name, ' - Pickup Location')
                ELSE 'Address not available'
            END,
            'special_instructions', COALESCE(v_delivery_schedule.special_instructions, v_order.special_instructions),
            'requested_at', v_delivery_schedule.requested_at,
            'business_hours', v_business_settings.business_hours
        )
    );

    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'error', 'Database error: ' || SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$function$;