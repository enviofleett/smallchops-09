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
    
    -- Log successful fetch for monitoring
    INSERT INTO audit_logs (action, category, message, entity_id, new_values)
    VALUES (
        'detailed_order_fetch_success',
        'Database Function',
        'Successfully fetched detailed order data',
        p_order_id,
        jsonb_build_object('items_count', jsonb_array_length(COALESCE(items_data, '[]'::jsonb)))
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Log error for debugging
    INSERT INTO audit_logs (action, category, message, entity_id, new_values)
    VALUES (
        'detailed_order_fetch_error',
        'Database Function Error',
        'Failed to fetch detailed order data: ' || SQLERRM,
        p_order_id,
        jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
    );
    
    RETURN jsonb_build_object(
        'error', 'Database error: ' || SQLERRM,
        'order_id', p_order_id,
        'success', false
    );
END;
$$;

-- PHASE 2: Security Hardening - Add search_path to all functions missing it
-- Fix security vulnerabilities identified in the linter

-- Update admin_update_order_status_production function
CREATE OR REPLACE FUNCTION public.admin_update_order_status_production(p_order_id uuid, p_new_status text, p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_record RECORD;
    v_old_status text;
    v_email_result jsonb;
    v_rate_limit_result jsonb;
    v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
BEGIN
    -- Check rate limit first
    SELECT * INTO v_rate_limit_result 
    FROM check_admin_rate_limit(p_admin_id, 'order_status_update', 50, 10);
    
    IF NOT (v_rate_limit_result->>'allowed')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Rate limit exceeded. Please wait before making more updates.',
            'rate_limit', v_rate_limit_result
        );
    END IF;
    
    -- Validate inputs
    IF p_new_status IS NULL OR p_new_status = 'null' OR p_new_status = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Status cannot be null or empty');
    END IF;

    IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid status: ' || p_new_status || '. Valid: ' || array_to_string(v_valid_statuses, ', ')
        );
    END IF;

    -- Start transaction with row locking
    SELECT * INTO v_order_record
    FROM orders 
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    v_old_status := v_order_record.status::text;
    
    -- Skip if unchanged
    IF v_old_status = p_new_status THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Status unchanged',
            'order', row_to_json(v_order_record)
        );
    END IF;
    
    -- Update order status atomically
    UPDATE orders 
    SET 
        status = p_new_status::order_status,
        updated_at = now(),
        updated_by = p_admin_id
    WHERE id = p_order_id;
    
    -- Queue email notification (non-blocking)
    IF v_order_record.customer_email IS NOT NULL AND 
       p_new_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
        
        SELECT * INTO v_email_result
        FROM admin_queue_order_email_enhanced(p_order_id, p_new_status);
    ELSE
        v_email_result := jsonb_build_object('success', true, 'message', 'No email required');
    END IF;
    
    -- Get updated order
    SELECT * INTO v_order_record FROM orders WHERE id = p_order_id;
    
    -- Log successful update
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
    VALUES (
        'admin_order_status_updated_production',
        'Order Management',
        'Production order status update: ' || v_old_status || ' → ' || p_new_status,
        p_admin_id,
        p_order_id,
        jsonb_build_object('status', v_old_status),
        jsonb_build_object(
            'status', p_new_status,
            'email_result', v_email_result,
            'rate_limit_used', v_rate_limit_result
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Order updated successfully',
        'order', row_to_json(v_order_record),
        'email_queued', v_email_result,
        'rate_limit', v_rate_limit_result
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log error with full context
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
    VALUES (
        'admin_order_status_update_failed_production',
        'Critical Error',
        'Production order status update failed: ' || SQLERRM,
        p_admin_id,
        p_order_id,
        jsonb_build_object(
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'old_status', v_old_status,
            'new_status', p_new_status
        )
    );
    
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Database error: ' || SQLERRM,
        'recovery_actions', jsonb_build_array(
            'Check network connection',
            'Refresh page and retry',
            'Contact system administrator'
        )
    );
END;
$$;

-- PHASE 3: Template Key Standardization
-- Create standardized template key mapping for consistent email operations

CREATE TABLE IF NOT EXISTS email_template_mapping (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    old_key text NOT NULL,
    new_key text NOT NULL,
    template_category text DEFAULT 'order_status',
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Insert standardized template mappings
INSERT INTO email_template_mapping (old_key, new_key, template_category) VALUES
('order_confirmed', 'order_confirmation', 'order_status'),
('order_preparing', 'order_status_update', 'order_status'),
('order_ready', 'order_status_update', 'order_status'),
('order_out_for_delivery', 'order_status_update', 'order_status'),
('order_delivered', 'order_status_update', 'order_status'),
('order_cancelled', 'order_status_update', 'order_status'),
('payment_confirmed', 'payment_confirmation', 'payment'),
('admin_new_order', 'admin_notification', 'admin')
ON CONFLICT DO NOTHING;

-- Create function to get standardized template key
CREATE OR REPLACE FUNCTION public.get_standardized_template_key(p_old_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_key text;
BEGIN
    SELECT new_key INTO v_new_key
    FROM email_template_mapping
    WHERE old_key = p_old_key AND is_active = true
    LIMIT 1;
    
    -- Return original key if no mapping found
    RETURN COALESCE(v_new_key, p_old_key);
END;
$$;

-- Enable RLS on email_template_mapping
ALTER TABLE email_template_mapping ENABLE ROW LEVEL SECURITY;

-- Create policies for email_template_mapping
CREATE POLICY "Admins can manage template mappings" ON email_template_mapping
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Service roles can read template mappings" ON email_template_mapping
    FOR SELECT USING (auth.role() = 'service_role');

-- Log completion
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
    'critical_fixes_migration_completed',
    'System Maintenance',
    'Applied critical fixes migration: database repair, security hardening, template standardization',
    jsonb_build_object(
        'functions_updated', 2,
        'security_fixes_applied', true,
        'template_mapping_created', true,
        'completion_time', now()
    )
);