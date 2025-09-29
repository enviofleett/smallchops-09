-- Simplify get_comprehensive_order_fulfillment_simple to avoid JSON casting errors
CREATE OR REPLACE FUNCTION public.get_comprehensive_order_fulfillment_simple(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'order', to_jsonb(o),
        'items', COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', oi.id,
                    'quantity', oi.quantity,
                    'unit_price', oi.unit_price,
                    'total_price', oi.total_price,
                    'product_name', oi.product_name,
                    'customizations', oi.customizations,
                    'special_instructions', oi.special_instructions
                )
            ) FILTER (WHERE oi.id IS NOT NULL),
            '[]'::jsonb
        ),
        'delivery_schedule', to_jsonb(ods),
        'fulfillment_info', jsonb_build_object(
            'type', o.order_type,
            'address', CASE 
                WHEN o.order_type = 'delivery' AND o.delivery_address IS NOT NULL THEN
                    COALESCE(
                        o.delivery_address->'address'->>'address_line_1',
                        o.delivery_address->>'address',
                        'Delivery address not available'
                    )
                ELSE 'Pickup location'
            END,
            'delivery_date', CASE 
                WHEN o.order_type = 'delivery' AND ods.delivery_date IS NOT NULL THEN
                    to_char(ods.delivery_date, 'YYYY-MM-DD')
                ELSE NULL
            END
        )
    ) INTO v_result
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN order_delivery_schedule ods ON o.id = ods.order_id
    WHERE o.id = p_order_id
    GROUP BY o.id, ods.id;

    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'error', 'Database error occurred',
        'error_detail', SQLERRM,
        'sqlstate', SQLSTATE,
        'order_id', p_order_id
    );
END;
$function$;