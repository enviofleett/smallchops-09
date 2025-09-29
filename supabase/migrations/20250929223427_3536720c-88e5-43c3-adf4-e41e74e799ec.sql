-- Fix uninitialized RECORD variables in get_comprehensive_order_fulfillment_simple
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
    v_assigned_driver RECORD;
    v_business_settings RECORD;
    v_order_items jsonb;
    v_communication_events jsonb;
    v_result jsonb;
    v_address text;
    v_special_instructions text;
    v_delivery_hours jsonb;
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

    -- Always fetch delivery schedule (don't condition on order type)
    SELECT * INTO v_delivery_schedule
    FROM order_delivery_schedule
    WHERE order_id = p_order_id;

    -- Always fetch pickup point if order has one
    SELECT * INTO v_pickup_point
    FROM pickup_points
    WHERE id = v_order.pickup_point_id;

    -- Always fetch business settings
    SELECT * INTO v_business_settings
    FROM business_settings
    ORDER BY updated_at DESC
    LIMIT 1;

    -- Always fetch assigned driver if order has one
    SELECT * INTO v_assigned_driver
    FROM drivers
    WHERE id = v_order.assigned_rider_id;

    -- Get order items with complete product details
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', oi.id,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'total_price', oi.total_price,
                'cost_price', COALESCE(p.cost_price, 0),
                'vat_rate', COALESCE(oi.vat_rate, 0),
                'vat_amount', COALESCE(oi.vat_amount, 0),
                'discount_amount', COALESCE(oi.discount_amount, 0),
                'special_instructions', COALESCE(oi.special_instructions, ''),
                'customizations', COALESCE(oi.customizations, ''),
                'product', jsonb_build_object(
                    'id', p.id,
                    'name', COALESCE(p.name, 'Product'),
                    'description', COALESCE(p.description, ''),
                    'price', COALESCE(p.price, 0),
                    'cost_price', COALESCE(p.cost_price, 0),
                    'image_url', p.image_url,
                    'category_id', p.category_id,
                    'features', COALESCE(p.features::text, '[]')::jsonb,
                    'ingredients', COALESCE(p.ingredients::text, '[]')::jsonb,
                    'images', CASE WHEN p.image_url IS NOT NULL THEN jsonb_build_array(p.image_url) ELSE '[]'::jsonb END
                )
            )
        ),
        '[]'::jsonb
    ) INTO v_order_items
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = p_order_id;

    -- Get communication events
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', ce.id,
                'event_type', ce.event_type,
                'recipient_email', ce.recipient_email,
                'status', ce.status::text,
                'created_at', ce.created_at,
                'sent_at', ce.sent_at,
                'processed_at', ce.processed_at,
                'retry_count', COALESCE(ce.retry_count, 0)
            ) ORDER BY ce.created_at DESC
        ),
        '[]'::jsonb
    ) INTO v_communication_events
    FROM communication_events ce
    WHERE ce.order_id = p_order_id;

    -- Aggregate special instructions safely (check if RECORD is populated)
    v_special_instructions := '';
    IF v_delivery_schedule.id IS NOT NULL AND 
       v_delivery_schedule.special_instructions IS NOT NULL AND 
       LENGTH(TRIM(v_delivery_schedule.special_instructions)) > 0 THEN
        v_special_instructions := v_delivery_schedule.special_instructions;
    ELSIF v_order.special_instructions IS NOT NULL AND LENGTH(TRIM(v_order.special_instructions)) > 0 THEN
        v_special_instructions := v_order.special_instructions;
    END IF;

    -- Resolve address with proper fallbacks
    v_address := 'Address not available';
    IF v_order.order_type = 'delivery' THEN
        BEGIN
            IF v_order.delivery_address IS NOT NULL THEN
                IF jsonb_typeof(v_order.delivery_address::jsonb) = 'object' THEN
                    v_address := COALESCE(
                        (v_order.delivery_address::jsonb)->>'address_line_1',
                        (v_order.delivery_address::jsonb)->>'address',
                        'Delivery address not available'
                    );
                ELSE
                    v_address := v_order.delivery_address::text;
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_address := COALESCE(v_order.delivery_address::text, 'Delivery address not available');
        END;
    ELSIF v_order.order_type = 'pickup' THEN
        IF v_pickup_point.id IS NOT NULL AND 
           v_pickup_point.address IS NOT NULL AND 
           LENGTH(TRIM(v_pickup_point.address)) > 0 THEN
            v_address := v_pickup_point.address;
        ELSIF v_business_settings.name IS NOT NULL THEN
            v_address := v_business_settings.name || ' - Main Location';
        ELSE
            v_address := 'Pickup location to be confirmed';
        END IF;
    END IF;

    -- Build delivery hours safely (check if RECORD is populated)
    v_delivery_hours := NULL;
    BEGIN
        IF v_order.order_type = 'delivery' AND 
           v_delivery_schedule.id IS NOT NULL AND 
           v_delivery_schedule.delivery_time_start IS NOT NULL THEN
            v_delivery_hours := jsonb_build_object(
                'start', v_delivery_schedule.delivery_time_start,
                'end', COALESCE(v_delivery_schedule.delivery_time_end, ''),
                'is_flexible', COALESCE(v_delivery_schedule.is_flexible, false)
            );
        ELSIF v_order.order_type = 'pickup' THEN
            IF v_pickup_point.id IS NOT NULL AND v_pickup_point.operating_hours IS NOT NULL THEN
                v_delivery_hours := v_pickup_point.operating_hours;
            ELSIF v_business_settings.business_hours IS NOT NULL THEN
                v_delivery_hours := v_business_settings.business_hours;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_delivery_hours := NULL;
    END;

    -- Build comprehensive result using subqueries for safer JSON handling
    v_result := jsonb_build_object(
        'order', row_to_json(v_order)::jsonb,
        'items', v_order_items,
        'communication_events', v_communication_events,
        'delivery_schedule', CASE 
            WHEN v_delivery_schedule.id IS NOT NULL THEN row_to_json(v_delivery_schedule)::jsonb
            ELSE NULL
        END,
        'pickup_point', CASE 
            WHEN v_pickup_point.id IS NOT NULL THEN row_to_json(v_pickup_point)::jsonb
            ELSE NULL
        END,
        'assigned_agent', CASE 
            WHEN v_assigned_driver.id IS NOT NULL THEN jsonb_build_object(
                'id', v_assigned_driver.id,
                'name', COALESCE(v_assigned_driver.name, ''),
                'phone', COALESCE(v_assigned_driver.phone, ''),
                'email', COALESCE(v_assigned_driver.email, ''),
                'vehicle_type', COALESCE(v_assigned_driver.vehicle_type, ''),
                'is_active', COALESCE(v_assigned_driver.is_active, false)
            )
            ELSE NULL
        END,
        'business_settings', COALESCE(row_to_json(v_business_settings)::jsonb, '{}'::jsonb),
        'fulfillment_info', jsonb_build_object(
            'type', v_order.order_type,
            'pickup_time', CASE 
                WHEN v_order.order_type = 'pickup' AND v_order.pickup_time IS NOT NULL THEN
                    to_char(v_order.pickup_time, 'YYYY-MM-DD HH24:MI')
                ELSE NULL
            END,
            'delivery_date', CASE 
                WHEN v_order.order_type = 'delivery' AND 
                     v_delivery_schedule.id IS NOT NULL AND 
                     v_delivery_schedule.delivery_date IS NOT NULL THEN
                    to_char(v_delivery_schedule.delivery_date, 'YYYY-MM-DD')
                ELSE NULL
            END,
            'delivery_hours', v_delivery_hours,
            'address', v_address,
            'special_instructions', v_special_instructions,
            'pickup_point_name', CASE WHEN v_pickup_point.id IS NOT NULL THEN COALESCE(v_pickup_point.name, '') ELSE '' END,
            'pickup_point_phone', CASE WHEN v_pickup_point.id IS NOT NULL THEN COALESCE(v_pickup_point.contact_phone, '') ELSE '' END
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
$function$;