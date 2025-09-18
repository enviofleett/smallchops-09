-- PHASE 1: Emergency Database Repair - Fix get_detailed_order_with_products function
-- This function was broken due to missing columns, causing 18+ failed migrations

DROP FUNCTION IF EXISTS public.get_detailed_order_with_products(uuid);

CREATE OR REPLACE FUNCTION public.get_detailed_order_with_products(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
    order_data jsonb;
    items_data jsonb;
    delivery_data jsonb;
BEGIN
    -- Get order details with proper error handling
    SELECT to_jsonb(o.*) INTO order_data
    FROM orders o
    WHERE o.id = p_order_id;
    
    IF order_data IS NULL THEN
        RETURN jsonb_build_object(
            'error', 'Order not found',
            'order_id', p_order_id
        );
    END IF;
    
    -- Get order items with product details
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', oi.id,
            'order_id', oi.order_id,
            'product_id', oi.product_id,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price,
            'product_name', oi.product_name,
            'product_description', oi.product_description,
            'product_image_url', oi.product_image_url,
            'created_at', oi.created_at,
            'updated_at', oi.updated_at,
            'product', CASE 
                WHEN p.id IS NOT NULL THEN
                    jsonb_build_object(
                        'id', p.id,
                        'name', p.name,
                        'description', p.description,
                        'price', p.price,
                        'image_url', p.image_url,
                        'category_id', p.category_id,
                        'is_available', p.is_available
                    )
                ELSE NULL
            END
        )
    ) INTO items_data
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = p_order_id;
    
    -- Get delivery schedule if exists
    SELECT to_jsonb(ods.*) INTO delivery_data
    FROM order_delivery_schedule ods
    WHERE ods.order_id = p_order_id
    LIMIT 1;
    
    -- Build final result
    result := jsonb_build_object(
        'order', order_data,
        'items', COALESCE(items_data, '[]'::jsonb),
        'delivery_schedule', delivery_data,
        'success', true,
        'fetched_at', now()
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Return error with details
    RETURN jsonb_build_object(
        'error', 'Database error: ' || SQLERRM,
        'order_id', p_order_id,
        'success', false
    );
END;
$$;