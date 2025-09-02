-- Fix trigger_order_emails function - remove non-existent reference column and use correct status
DROP FUNCTION IF EXISTS public.trigger_order_emails(uuid);

CREATE OR REPLACE FUNCTION public.trigger_order_emails(order_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    order_record RECORD;
BEGIN
    -- Get order details
    SELECT 
        o.*,
        ca.email as customer_email,
        ca.name as customer_name
    INTO order_record
    FROM orders o
    LEFT JOIN customer_accounts ca ON o.customer_id = ca.id
    WHERE o.id = order_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', order_uuid;
    END IF;
    
    -- Insert order confirmation event
    INSERT INTO communication_events (
        event_type,
        recipient_email,
        order_id,
        status,
        template_variables,
        external_id,
        created_at
    ) VALUES (
        'order_confirmation',
        order_record.customer_email,
        order_uuid,
        'queued'::communication_event_status,
        jsonb_build_object(
            'customer_name', order_record.customer_name,
            'order_number', order_record.order_number,
            'total_amount', order_record.total_amount,
            'order_id', order_uuid
        ),
        order_record.order_number, -- Store order number in external_id
        NOW()
    );
    
    -- Log the email trigger
    INSERT INTO audit_logs (
        action,
        category,
        message,
        entity_id,
        new_values
    ) VALUES (
        'order_email_triggered',
        'Communication',
        'Order confirmation email queued for order: ' || order_record.order_number,
        order_uuid,
        jsonb_build_object(
            'order_id', order_uuid,
            'customer_email', order_record.customer_email,
            'event_type', 'order_confirmation'
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block order creation
    INSERT INTO audit_logs (
        action,
        category,
        message,
        entity_id,
        new_values
    ) VALUES (
        'order_email_trigger_failed',
        'Communication',
        'Failed to trigger order confirmation email: ' || SQLERRM,
        order_uuid,
        jsonb_build_object(
            'order_id', order_uuid,
            'error', SQLERRM,
            'sqlstate', SQLSTATE
        )
    );
END;
$$;