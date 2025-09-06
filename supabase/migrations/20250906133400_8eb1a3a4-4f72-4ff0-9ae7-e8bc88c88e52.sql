-- Fix the get_detailed_order_with_products function GROUP BY issue
DROP FUNCTION IF EXISTS get_detailed_order_with_products(uuid);

CREATE OR REPLACE FUNCTION get_detailed_order_with_products(p_order_id UUID)
RETURNS TABLE (
    id UUID,
    order_number TEXT,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    status TEXT,
    payment_status TEXT,
    total_amount NUMERIC,
    created_at TIMESTAMPTZ,
    order_items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.status,
        o.payment_status,
        o.total_amount,
        o.created_at,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', oi.id,
                    'product_id', oi.product_id,
                    'product_name', oi.product_name,
                    'quantity', oi.quantity,
                    'unit_price', oi.unit_price,
                    'total_price', oi.total_price,
                    'products', CASE 
                        WHEN p.id IS NOT NULL THEN 
                            jsonb_build_object(
                                'id', p.id,
                                'name', p.name,
                                'description', p.description,
                                'price', p.price,
                                'image_url', p.image_url,
                                'category_id', p.category_id,
                                'features', p.features,
                                'ingredients', p.ingredients
                            )
                        ELSE NULL
                    END
                ) ORDER BY oi.created_at
            ) FILTER (WHERE oi.id IS NOT NULL), 
            '[]'::jsonb
        ) AS order_items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE o.id = p_order_id
    GROUP BY 
        o.id, 
        o.order_number, 
        o.customer_name, 
        o.customer_email, 
        o.customer_phone,
        o.status,
        o.payment_status, 
        o.total_amount, 
        o.created_at;
END;
$$;