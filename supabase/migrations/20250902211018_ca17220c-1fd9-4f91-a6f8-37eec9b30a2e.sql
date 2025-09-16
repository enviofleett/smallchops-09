-- Drop the existing trigger and old function completely
DROP TRIGGER IF EXISTS trigger_order_emails ON orders;
DROP FUNCTION IF EXISTS public.trigger_order_emails() CASCADE;

-- Create the corrected trigger function 
CREATE OR REPLACE FUNCTION public.trigger_order_emails()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    order_record RECORD;
    confirmation_result RECORD;
BEGIN
    -- Only handle order_confirmation on INSERT and order_status_update on status change
    
    IF TG_OP = 'INSERT' THEN
        -- Get customer details for the new order
        SELECT 
            NEW.*,
            ca.email as customer_email_lookup,
            ca.name as customer_name_lookup
        INTO order_record
        FROM customer_accounts ca 
        WHERE ca.id = NEW.customer_id;
        
        -- Order confirmation email on new orders
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
            COALESCE(order_record.customer_email_lookup, NEW.customer_email),
            NEW.id,
            'queued'::communication_event_status,
            jsonb_build_object(
                'customer_name', COALESCE(order_record.customer_name_lookup, NEW.customer_name),
                'order_number', NEW.order_number,
                'order_date', NEW.created_at::text,
                'total_amount', NEW.total_amount::text,
                'order_id', NEW.id
            ),
            NEW.order_number,
            NOW()
        );
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Order status update email on status changes (excluding payment status)
        IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status != OLD.status THEN
            INSERT INTO communication_events (
                event_type,
                recipient_email,
                order_id,
                status,
                template_variables,
                external_id,
                created_at
            ) VALUES (
                'order_status_update',
                NEW.customer_email,
                NEW.id,
                'queued'::communication_event_status,
                jsonb_build_object(
                    'customer_name', NEW.customer_name,
                    'order_number', NEW.order_number,
                    'old_status', OLD.status,
                    'new_status', NEW.status,
                    'status_date', NOW()::text,
                    'order_id', NEW.id
                ),
                NEW.order_number,
                NOW()
            );
        END IF;
        
        -- Payment confirmation using idempotent RPC when payment_status changes
        IF OLD.payment_status IS DISTINCT FROM NEW.payment_status AND
           NEW.payment_status IN ('completed', 'confirmed') AND
           NEW.payment_reference IS NOT NULL THEN
            
            -- Use idempotent RPC to prevent duplicate key violations
            SELECT * INTO confirmation_result FROM public.upsert_payment_confirmation_event(
                p_reference := NEW.payment_reference,
                p_recipient_email := NEW.customer_email,
                p_order_id := NEW.id,
                p_template_variables := jsonb_build_object(
                    'customer_name', NEW.customer_name,
                    'order_number', NEW.order_number,
                    'amount', NEW.total_amount::text,
                    'payment_method', COALESCE(NEW.payment_method, 'Online Payment'),
                    'payment_reference', NEW.payment_reference,
                    'confirmation_date', NOW()::text,
                    'order_id', NEW.id
                )
            );
            
            -- Don't fail the transaction even if RPC fails
            IF confirmation_result.success = false THEN
                -- Log the issue in audit logs instead of failing
                INSERT INTO audit_logs (
                    action, category, message, entity_id, new_values
                ) VALUES (
                    'payment_confirmation_failed', 
                    'Communication',
                    'Payment confirmation RPC failed: ' || confirmation_result.message,
                    NEW.id,
                    jsonb_build_object('order_id', NEW.id, 'error', confirmation_result.message)
                );
            END IF;
        END IF;
    END IF;
    
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block order creation
    INSERT INTO audit_logs (
        action, category, message, entity_id, new_values
    ) VALUES (
        'order_email_trigger_failed',
        'Communication', 
        'Order email trigger failed: ' || SQLERRM,
        COALESCE(NEW.id, OLD.id),
        jsonb_build_object(
            'order_id', COALESCE(NEW.id, OLD.id),
            'error', SQLERRM,
            'sqlstate', SQLSTATE
        )
    );
    
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trigger_order_emails
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_order_emails();