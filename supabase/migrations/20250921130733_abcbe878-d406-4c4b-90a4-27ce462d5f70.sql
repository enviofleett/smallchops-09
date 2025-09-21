-- Create notification queue table for reliable email processing
CREATE TABLE IF NOT EXISTS order_status_notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid NOT NULL,
    old_status text,
    new_status text NOT NULL,
    customer_email text,
    customer_name text,
    order_number text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    processed_at timestamp with time zone,
    retry_count integer NOT NULL DEFAULT 0,
    error_message text,
    template_key text,
    template_variables jsonb DEFAULT '{}'::jsonb
);

-- Add indexes for efficient processing
CREATE INDEX IF NOT EXISTS idx_notifications_unprocessed 
ON order_status_notifications(processed_at, retry_count, created_at) 
WHERE processed_at IS NULL AND retry_count < 3;

CREATE INDEX IF NOT EXISTS idx_notifications_order_id 
ON order_status_notifications(order_id);

-- Enable RLS
ALTER TABLE order_status_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all notifications" 
ON order_status_notifications FOR SELECT 
USING (is_admin());

CREATE POLICY "Service role can manage notifications" 
ON order_status_notifications FOR ALL 
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Update the admin_update_order_status_simple function to use reliable notification queue
CREATE OR REPLACE FUNCTION admin_update_order_status_simple(
    order_id_param uuid, 
    new_status_param text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    old_status_var text;
    order_info RECORD;
    template_key_var text;
    result jsonb;
BEGIN
    -- Get order information
    SELECT 
        status, 
        customer_email, 
        customer_name, 
        order_number 
    INTO order_info
    FROM orders 
    WHERE id = order_id_param;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order not found'
        );
    END IF;

    old_status_var := order_info.status;
    
    -- Skip if status unchanged
    IF old_status_var = new_status_param THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Status unchanged',
            'order_id', order_id_param,
            'status', new_status_param
        );
    END IF;

    -- Update order status (this always succeeds)
    UPDATE orders 
    SET 
        status = new_status_param::order_status,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = order_id_param;

    -- Determine template key for email
    CASE new_status_param
        WHEN 'confirmed' THEN template_key_var := 'order_confirmed';
        WHEN 'preparing' THEN template_key_var := 'order_preparing';
        WHEN 'ready' THEN template_key_var := 'order_ready';
        WHEN 'out_for_delivery' THEN template_key_var := 'order_out_for_delivery';
        WHEN 'delivered' THEN template_key_var := 'order_delivered';
        WHEN 'cancelled' THEN template_key_var := 'order_cancelled';
        ELSE template_key_var := 'order_status_update';
    END CASE;

    -- Queue email notification if customer email exists
    IF order_info.customer_email IS NOT NULL AND 
       new_status_param IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
        
        INSERT INTO order_status_notifications (
            order_id, 
            old_status, 
            new_status,
            customer_email,
            customer_name,
            order_number,
            template_key,
            template_variables
        ) VALUES (
            order_id_param,
            old_status_var,
            new_status_param,
            order_info.customer_email,
            order_info.customer_name,
            order_info.order_number,
            template_key_var,
            jsonb_build_object(
                'customer_name', COALESCE(order_info.customer_name, 'Customer'),
                'order_number', order_info.order_number,
                'status_display', initcap(replace(new_status_param, '_', ' ')),
                'old_status', old_status_var,
                'new_status', new_status_param
            )
        );
    END IF;

    -- Log successful update
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
    VALUES (
        'admin_order_status_updated_reliable',
        'Order Management',
        'Reliable order status update: ' || old_status_var || ' → ' || new_status_param,
        auth.uid(),
        order_id_param,
        jsonb_build_object('status', old_status_var),
        jsonb_build_object(
            'status', new_status_param,
            'email_queued', order_info.customer_email IS NOT NULL
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', order_id_param,
        'old_status', old_status_var,
        'new_status', new_status_param,
        'email_queued', order_info.customer_email IS NOT NULL,
        'message', 'Order updated successfully. ' || 
            CASE WHEN order_info.customer_email IS NOT NULL 
                 THEN 'Email notification queued for delivery.'
                 ELSE 'No email sent (customer email not available).'
            END
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log error but still return success for status update
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
    VALUES (
        'admin_order_status_update_error',
        'Critical Error',
        'Order status update error: ' || SQLERRM,
        auth.uid(),
        order_id_param,
        jsonb_build_object(
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'new_status', new_status_param
        )
    );
    
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Database error: ' || SQLERRM
    );
END;
$$;