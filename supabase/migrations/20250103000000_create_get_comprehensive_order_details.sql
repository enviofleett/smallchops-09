-- Create get_comprehensive_order_details function with safe JSON handling
-- Fixes PostgreSQL error 22P02: invalid input syntax for type json

CREATE OR REPLACE FUNCTION get_comprehensive_order_details(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_order RECORD;
    v_items_data JSONB;
    v_delivery_address JSONB;
BEGIN
    -- Get order details with safe error handling
    BEGIN
        SELECT * INTO v_order
        FROM orders o
        WHERE o.id = p_order_id;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'error', 'Order not found',
                'order_id', p_order_id
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', 'Failed to fetch order',
            'details', SQLERRM
        );
    END;

    -- Safely handle delivery_address JSON parsing
    v_delivery_address := NULL;
    IF v_order.delivery_address IS NOT NULL THEN
        BEGIN
            -- Try to parse as JSON first
            IF jsonb_typeof(v_order.delivery_address::jsonb) IN ('object', 'array') THEN
                v_delivery_address := v_order.delivery_address::jsonb;
            ELSE
                -- Treat as plain text
                v_delivery_address := jsonb_build_object('address', v_order.delivery_address::text);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- If JSON parsing fails, wrap as text object
            v_delivery_address := jsonb_build_object('address', v_order.delivery_address::text);
        END;
    END IF;

    -- Get order items with safe aggregation
    BEGIN
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', oi.id,
                    'product_id', oi.product_id,
                    'product_name', COALESCE(oi.product_name::text, ''),
                    'quantity', COALESCE(oi.quantity::numeric, 0),
                    'unit_price', COALESCE(oi.unit_price::numeric, 0),
                    'total_price', COALESCE(oi.total_price::numeric, 0),
                    'customizations', CASE 
                        WHEN oi.customizations IS NOT NULL THEN 
                            CASE 
                                WHEN jsonb_typeof(oi.customizations) = 'object' THEN oi.customizations
                                WHEN jsonb_typeof(oi.customizations) = 'array' THEN oi.customizations
                                ELSE '{}'::jsonb
                            END
                        ELSE '{}'::jsonb
                    END,
                    'special_instructions', COALESCE(oi.special_instructions::text, '')
                )
            ) FILTER (WHERE oi.id IS NOT NULL),
            '[]'::jsonb
        ) INTO v_items_data
        FROM order_items oi
        WHERE oi.order_id = p_order_id;
    EXCEPTION WHEN OTHERS THEN
        v_items_data := '[]'::jsonb;
    END;

    -- Build final result with safe casting
    BEGIN
        v_result := jsonb_build_object(
            'id', v_order.id,
            'order_number', COALESCE(v_order.order_number::text, ''),
            'customer_name', COALESCE(v_order.customer_name::text, ''),
            'customer_email', COALESCE(v_order.customer_email::text, ''),
            'customer_phone', COALESCE(v_order.customer_phone::text, ''),
            'order_type', COALESCE(v_order.order_type::text, 'delivery'),
            'status', COALESCE(v_order.status::text, 'pending'),
            'payment_status', COALESCE(v_order.payment_status::text, 'pending'),
            'subtotal', COALESCE(v_order.subtotal::numeric, 0),
            'tax_amount', COALESCE(v_order.tax_amount::numeric, 0),
            'delivery_fee', COALESCE(v_order.delivery_fee::numeric, 0),
            'discount_amount', COALESCE(v_order.discount_amount::numeric, 0),
            'total_amount', COALESCE(v_order.total_amount::numeric, 0),
            'delivery_address', v_delivery_address,
            'delivery_time', v_order.delivery_time,
            'special_instructions', COALESCE(v_order.special_instructions::text, ''),
            'payment_method', COALESCE(v_order.payment_method::text, ''),
            'payment_reference', COALESCE(v_order.payment_reference::text, ''),
            'created_at', v_order.created_at,
            'updated_at', v_order.updated_at,
            'items', v_items_data
        );
        
        RETURN v_result;
        
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', 'Failed to build order details',
            'details', SQLERRM
        );
    END;
    
EXCEPTION WHEN OTHERS THEN
    -- Final fallback error handler
    RETURN jsonb_build_object(
        'error', 'Failed to fetch order',
        'details', SQLERRM
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment explaining the function
COMMENT ON FUNCTION get_comprehensive_order_details(UUID) IS 
'Safely retrieves comprehensive order details with proper JSON handling and type casting. 
Never throws invalid JSON errors and always returns valid JSON structure.';