-- Fix the get_comprehensive_order_fulfillment function to use correct field names
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
    v_address text;
    v_special_instructions text;
    v_pickup_hours jsonb;
    v_delivery_hours jsonb;
    v_assigned_driver RECORD;
BEGIN
    -- Get order details with error handling
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'error', 'Order not found',
            'order_id', p_order_id
        );
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

    -- Get assigned driver information
    IF v_order.assigned_rider_id IS NOT NULL THEN
        SELECT * INTO v_assigned_driver
        FROM drivers
        WHERE id = v_order.assigned_rider_id;
    END IF;

    -- Get business settings (for pickup address fallback)
    SELECT * INTO v_business_settings
    FROM business_settings
    ORDER BY updated_at DESC
    LIMIT 1;

    -- Get order items with product details
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

    -- Aggregate special instructions from available sources only
    v_special_instructions := TRIM(COALESCE(
        CASE 
            WHEN v_delivery_schedule.special_instructions IS NOT NULL AND LENGTH(TRIM(v_delivery_schedule.special_instructions)) > 0
            THEN v_delivery_schedule.special_instructions
            ELSE NULL
        END ||
        CASE 
            WHEN v_order.special_instructions IS NOT NULL AND LENGTH(TRIM(v_order.special_instructions)) > 0
            THEN CASE WHEN v_delivery_schedule.special_instructions IS NOT NULL THEN ' | ' || v_order.special_instructions ELSE v_order.special_instructions END
            ELSE NULL
        END,
        ''
    ));

    -- Resolve address with proper fallbacks
    IF v_order.order_type = 'delivery' THEN
        -- For delivery orders, extract address from delivery_address JSON
        IF v_order.delivery_address IS NOT NULL THEN
            v_address := COALESCE(
                v_order.delivery_address->>'address_line_1',
                v_order.delivery_address->>'address',
                v_order.delivery_address::text
            );
            IF v_address IS NULL OR LENGTH(TRIM(v_address)) = 0 THEN
                v_address := 'Delivery address not available';
            END IF;
        ELSE
            v_address := 'Delivery address not provided';
        END IF;
    ELSIF v_order.order_type = 'pickup' THEN
        -- For pickup orders, use pickup point address or business address
        IF v_pickup_point.address IS NOT NULL AND LENGTH(TRIM(v_pickup_point.address)) > 0 THEN
            v_address := v_pickup_point.address;
        ELSIF v_business_settings.name IS NOT NULL THEN
            v_address := v_business_settings.name || ' - Main Location';
        ELSE
            v_address := 'Pickup location to be confirmed';
        END IF;
    ELSE
        v_address := 'Address not available';
    END IF;

    -- Build delivery hours for both delivery and pickup
    IF v_order.order_type = 'delivery' AND v_delivery_schedule.delivery_time_start IS NOT NULL THEN
        v_delivery_hours := jsonb_build_object(
            'start', v_delivery_schedule.delivery_time_start,
            'end', v_delivery_schedule.delivery_time_end,
            'is_flexible', COALESCE(v_delivery_schedule.is_flexible, false)
        );
    ELSIF v_order.order_type = 'pickup' AND v_pickup_point.operating_hours IS NOT NULL THEN
        v_delivery_hours := v_pickup_point.operating_hours;
    ELSIF v_order.order_type = 'pickup' AND v_business_settings.business_hours IS NOT NULL THEN
        v_delivery_hours := v_business_settings.business_hours;
    ELSE
        v_delivery_hours := NULL;
    END IF;

    -- Build comprehensive result with enhanced pickup-specific logic and timeline
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
        'assigned_agent', CASE 
            WHEN v_assigned_driver.id IS NOT NULL THEN jsonb_build_object(
                'id', v_assigned_driver.id,
                'name', v_assigned_driver.name,
                'phone', v_assigned_driver.phone,
                'vehicle_type', v_assigned_driver.vehicle_type,
                'vehicle_brand', v_assigned_driver.vehicle_brand,
                'vehicle_model', v_assigned_driver.vehicle_model,
                'license_plate', v_assigned_driver.license_plate
            )
            ELSE NULL
        END,
        'business_settings', to_jsonb(v_business_settings),
        'timeline', jsonb_build_array(
            jsonb_build_object(
                'event', 'Order Created',
                'timestamp', v_order.created_at,
                'status', 'completed'
            ),
            CASE 
                WHEN v_order.status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered') THEN
                    jsonb_build_object(
                        'event', 'Order Confirmed',
                        'timestamp', v_order.updated_at,
                        'status', 'completed'
                    )
                ELSE
                    jsonb_build_object(
                        'event', 'Order Confirmed',
                        'timestamp', NULL,
                        'status', 'pending'
                    )
            END,
            CASE 
                WHEN v_order.status IN ('preparing', 'ready', 'out_for_delivery', 'delivered') THEN
                    jsonb_build_object(
                        'event', 'Preparation Started',
                        'timestamp', v_order.updated_at,
                        'status', 'completed'
                    )
                ELSE
                    jsonb_build_object(
                        'event', 'Preparation Started',
                        'timestamp', NULL,
                        'status', 'pending'
                    )
            END,
            CASE 
                WHEN v_order.status IN ('ready', 'out_for_delivery', 'delivered') THEN
                    jsonb_build_object(
                        'event', CASE WHEN v_order.order_type = 'pickup' THEN 'Ready for Pickup' ELSE 'Ready for Delivery' END,
                        'timestamp', v_order.updated_at,
                        'status', 'completed'
                    )
                ELSE
                    jsonb_build_object(
                        'event', CASE WHEN v_order.order_type = 'pickup' THEN 'Ready for Pickup' ELSE 'Ready for Delivery' END,
                        'timestamp', NULL,
                        'status', 'pending'
                    )
            END,
            CASE 
                WHEN v_order.status = 'delivered' THEN
                    jsonb_build_object(
                        'event', CASE WHEN v_order.order_type = 'pickup' THEN 'Order Picked Up' ELSE 'Order Delivered' END,
                        'timestamp', v_order.updated_at,
                        'status', 'completed'
                    )
                ELSE
                    jsonb_build_object(
                        'event', CASE WHEN v_order.order_type = 'pickup' THEN 'Order Picked Up' ELSE 'Order Delivered' END,
                        'timestamp', NULL,
                        'status', 'pending'
                    )
            END
        ),
        'fulfillment_info', jsonb_build_object(
            'type', v_order.order_type,
            'booking_window', CASE 
                WHEN v_order.order_type = 'pickup' AND v_order.pickup_time IS NOT NULL THEN 
                    to_char(v_order.pickup_time, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                WHEN v_delivery_schedule.delivery_date IS NOT NULL THEN 
                    to_char(v_delivery_schedule.delivery_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                ELSE NULL
            END,
            'pickup_time', CASE 
                WHEN v_order.order_type = 'pickup' AND v_order.pickup_time IS NOT NULL THEN
                    to_char(v_order.pickup_time, 'YYYY-MM-DD HH24:MI')
                ELSE NULL
            END,
            'delivery_date', CASE 
                WHEN v_order.order_type = 'delivery' AND v_delivery_schedule.delivery_date IS NOT NULL THEN
                    to_char(v_delivery_schedule.delivery_date, 'YYYY-MM-DD')
                ELSE NULL
            END,
            'delivery_hours', v_delivery_hours,
            'address', v_address,
            'special_instructions', v_special_instructions,
            'order_instructions', v_order.special_instructions,
            'schedule_instructions', v_delivery_schedule.special_instructions,
            'requested_at', v_delivery_schedule.requested_at,
            'business_hours', v_business_settings.business_hours,
            'pickup_point_name', v_pickup_point.name,
            'pickup_point_phone', v_pickup_point.contact_phone,
            'pickup_point_hours', v_pickup_point.operating_hours
        )
    );

    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'error', 'Database error occurred while fetching order details',
        'error_detail', SQLERRM,
        'sqlstate', SQLSTATE,
        'order_id', p_order_id,
        'timestamp', now()
    );
END;
$function$