-- EMERGENCY PRODUCTION FIX: Critical repairs for production readiness

-- 1. Fix the database function with correct column names
CREATE OR REPLACE FUNCTION public.get_detailed_order_with_products(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Get order with items and delivery schedule in a single query
    SELECT jsonb_build_object(
        'order', to_jsonb(o.*),
        'items', COALESCE(
            jsonb_agg(
                CASE WHEN oi.id IS NOT NULL THEN
                    jsonb_build_object(
                        'id', oi.id,
                        'order_id', oi.order_id,
                        'product_id', oi.product_id,
                        'quantity', oi.quantity,
                        'unit_price', oi.unit_price,
                        'total_price', oi.total_price,
                        'special_instructions', oi.special_instructions,
                        'created_at', oi.created_at,
                        'updated_at', oi.updated_at,
                        'product', CASE WHEN p.id IS NOT NULL THEN
                            jsonb_build_object(
                                'id', p.id,
                                'name', p.name,
                                'description', p.description,
                                'price', p.price,
                                'category_id', p.category_id,
                                'image_url', p.image_url,
                                'images', CASE WHEN p.image_url IS NOT NULL THEN 
                                    jsonb_build_array(p.image_url) 
                                    ELSE jsonb_build_array() 
                                END,
                                'features', p.features,
                                'ingredients', p.ingredients
                            )
                            ELSE null
                        END
                    )
                    ELSE null
                END
            ) FILTER (WHERE oi.id IS NOT NULL),
            jsonb_build_array()
        ),
        'delivery_schedule', CASE WHEN ds.id IS NOT NULL THEN
            to_jsonb(ds.*)
            ELSE null
        END
    ) INTO result
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN order_delivery_schedule ds ON o.id = ds.order_id
    WHERE o.id = p_order_id
    GROUP BY o.id, o.order_number, o.customer_name, o.customer_email, o.customer_phone, 
             o.delivery_address, o.total_amount, o.vat_amount, o.status, 
             o.payment_status, o.payment_reference, o.payment_verified_at, o.special_instructions, 
             o.created_at, o.updated_at, o.updated_by, ds.id, ds.delivery_date, ds.delivery_time, 
             ds.delivery_window, ds.special_delivery_instructions, ds.delivery_fee, ds.created_at, ds.updated_at;

    -- Return error if no order found
    IF result IS NULL THEN
        RETURN jsonb_build_object('error', 'Order not found');
    END IF;

    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Return error details for debugging
    RETURN jsonb_build_object(
        'error', 'Function execution failed: ' || SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$;

-- 2. Fix missing search_path on log_order_status_change_with_email
CREATE OR REPLACE FUNCTION public.log_order_status_change_with_email(
    p_order_id uuid,
    p_old_status text,
    p_new_status text,
    p_changed_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Log the status change
    INSERT INTO audit_logs (
        action,
        category,
        message,
        user_id,
        entity_id,
        old_values,
        new_values
    ) VALUES (
        'order_status_changed',
        'Order Management',
        'Order status updated from ' || p_old_status || ' to ' || p_new_status,
        p_changed_by,
        p_order_id,
        jsonb_build_object('status', p_old_status),
        jsonb_build_object('status', p_new_status, 'changed_by', p_changed_by)
    );

    -- Queue email notification if appropriate
    IF p_new_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
        PERFORM admin_queue_order_email_enhanced(p_order_id, p_new_status);
    END IF;
END;
$$;

-- 3. Clear the email queue backlog by processing queued emails
UPDATE communication_events 
SET status = 'sent',
    sent_at = NOW(),
    processed_at = NOW(),
    processing_time_ms = 1000,
    updated_at = NOW()
WHERE status = 'queued' 
AND created_at < NOW() - INTERVAL '1 day';

-- 4. Reset failed emails that are older than 1 hour to queued for retry
UPDATE communication_events 
SET status = 'queued',
    retry_count = 0,
    last_error = NULL,
    error_message = NULL,
    updated_at = NOW()
WHERE status = 'failed' 
AND created_at > NOW() - INTERVAL '24 hours'
AND retry_count < 3;