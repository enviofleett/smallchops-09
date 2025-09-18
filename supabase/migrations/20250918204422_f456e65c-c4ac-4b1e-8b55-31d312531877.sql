-- EMERGENCY SIMPLE FIX: Create minimal working function
DROP FUNCTION IF EXISTS public.get_detailed_order_with_products(uuid);

CREATE OR REPLACE FUNCTION public.get_detailed_order_with_products(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    order_data jsonb;
    items_data jsonb;
    delivery_data jsonb;
BEGIN
    -- Get basic order data
    SELECT to_jsonb(o.*) INTO order_data
    FROM orders o
    WHERE o.id = p_order_id;
    
    IF order_data IS NULL THEN
        RETURN jsonb_build_object('error', 'Order not found');
    END IF;
    
    -- Get order items with products
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', oi.id,
            'order_id', oi.order_id,
            'product_id', oi.product_id,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price,
            'product', CASE WHEN p.id IS NOT NULL THEN
                jsonb_build_object(
                    'id', p.id,
                    'name', p.name,
                    'description', p.description,
                    'price', p.price,
                    'image_url', p.image_url,
                    'images', CASE WHEN p.image_url IS NOT NULL THEN 
                        jsonb_build_array(p.image_url) 
                        ELSE jsonb_build_array() 
                    END
                )
                ELSE null
            END
        )
    ), jsonb_build_array()) INTO items_data
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = p_order_id;
    
    -- Get delivery schedule
    SELECT to_jsonb(ds.*) INTO delivery_data
    FROM order_delivery_schedule ds
    WHERE ds.order_id = p_order_id;
    
    RETURN jsonb_build_object(
        'order', order_data,
        'items', items_data,
        'delivery_schedule', delivery_data
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'error', 'Function failed: ' || SQLERRM
    );
END;
$$;