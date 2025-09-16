-- Fix critical production issues

-- 1. Add missing admin_notes column to orders table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'admin_notes'
    ) THEN
        ALTER TABLE orders ADD COLUMN admin_notes TEXT;
    END IF;
END $$;

-- 2. Add missing created_at column to order_items table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE order_items ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        ALTER TABLE order_items ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        -- Add trigger for updated_at
        CREATE TRIGGER update_order_items_updated_at
            BEFORE UPDATE ON order_items
            FOR EACH ROW
            EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;

-- 3. Fix the database function to handle admin_notes properly
CREATE OR REPLACE FUNCTION public.get_detailed_order_with_products(p_order_id uuid)
RETURNS TABLE(
    id uuid, 
    order_number text, 
    customer_name text, 
    customer_email text, 
    customer_phone text, 
    status text, 
    payment_status text, 
    total_amount numeric, 
    created_at timestamp with time zone, 
    admin_notes text,
    order_items jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        o.admin_notes,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', oi.id,
                    'product_id', oi.product_id,
                    'product_name', oi.product_name,
                    'quantity', oi.quantity,
                    'unit_price', oi.unit_price,
                    'total_price', oi.total_price,
                    'created_at', COALESCE(oi.created_at, o.created_at),
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
                ) ORDER BY COALESCE(oi.created_at, o.created_at)
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
        o.created_at,
        o.admin_notes;
END;
$function$;