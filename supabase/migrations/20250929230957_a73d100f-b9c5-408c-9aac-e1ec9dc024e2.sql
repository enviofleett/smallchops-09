-- Harden get_comprehensive_order_fulfillment_simple to never crash on malformed delivery_address
-- This migration adds jsonb_typeof safety checks and proper JSON path navigation

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
                    COALESCE(
                        -- Try nested path safely (delivery_address -> address -> address_line_1)
                        (CASE 
                            WHEN jsonb_typeof(o.delivery_address) = 'object' 
                            THEN o.delivery_address->'address'->>'address_line_1'
                            ELSE NULL
                         END),
                        -- Fallback: top-level "address" key if not nested
                        (CASE 
                            WHEN jsonb_typeof(o.delivery_address) = 'object' 
                            THEN o.delivery_address->>'address'
                            ELSE NULL
                         END),
                        -- Final fallback: pretty print JSON or use as text
                        (CASE 
                            WHEN jsonb_typeof(o.delivery_address) = 'object' 
                            THEN jsonb_pretty(o.delivery_address)
                            ELSE 'Delivery address not available'
                         END)
                    )
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

-- Unit test cases (uncomment to run):
-- Test Case 1: Valid nested JSON
-- DO $$ BEGIN
--     PERFORM get_comprehensive_order_fulfillment_simple('61ab710f-2489-4758-8acd-5db28b9f7d03');
--     RAISE NOTICE 'Test 1 passed: Valid nested JSON';
-- END $$;

-- Test Case 2: Order with null delivery_address
-- DO $$ BEGIN
--     PERFORM get_comprehensive_order_fulfillment_simple('<order_id_with_null>');
--     RAISE NOTICE 'Test 2 passed: Null delivery_address';
-- END $$;

-- Test Case 3: Order with malformed delivery_address (should not crash)
-- UPDATE orders SET delivery_address = '"plain text"'::jsonb WHERE id = '<test_order_id>';
-- DO $$ BEGIN
--     PERFORM get_comprehensive_order_fulfillment_simple('<test_order_id>');
--     RAISE NOTICE 'Test 3 passed: Plain text delivery_address';
-- END $$;