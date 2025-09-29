-- Fix JSON casting issues in get_comprehensive_order_fulfillment_simple function
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
        'order', row_to_json(o)::jsonb,
        'items', COALESCE(
            (
                SELECT jsonb_agg(
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
                            'features', COALESCE(p.features, '[]'::jsonb),
                            'ingredients', CASE 
                                WHEN p.ingredients IS NULL THEN '[]'::jsonb
                                WHEN is_jsonb_valid(p.ingredients) THEN p.ingredients::jsonb
                                ELSE '[]'::jsonb
                            END,
                            'images', CASE 
                                WHEN p.image_url IS NOT NULL THEN jsonb_build_array(p.image_url) 
                                ELSE '[]'::jsonb 
                            END
                        )
                    )
                )
                FROM order_items oi
                LEFT JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = p_order_id
            ),
            '[]'::jsonb
        ),
        'delivery_schedule', (
            SELECT row_to_json(ods)::jsonb
            FROM order_delivery_schedule ods
            WHERE ods.order_id = p_order_id
            LIMIT 1
        ),
        'fulfillment_info', jsonb_build_object(
            'type', o.order_type,
            'address', CASE 
                WHEN o.order_type = 'delivery' AND o.delivery_address IS NOT NULL THEN
                    CASE 
                        WHEN is_jsonb_valid(o.delivery_address::text) THEN
                            COALESCE(
                                (o.delivery_address::jsonb)->>'address_line_1',
                                (o.delivery_address::jsonb)->>'address',
                                'Delivery address not available'
                            )
                        ELSE o.delivery_address::text
                    END
                ELSE 'Pickup location'
            END,
            'special_instructions', COALESCE(o.special_instructions, '')
        )
    ) INTO v_result
    FROM orders o
    WHERE o.id = p_order_id;

    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'error', 'Failed to fetch order details',
        'error_detail', SQLERRM,
        'sqlstate', SQLSTATE,
        'order_id', p_order_id
    );
END;
$function$;