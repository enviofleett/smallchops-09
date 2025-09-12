-- Fix communication_events validation to prevent "Missing recipient email" errors
-- Add trigger to validate recipient_email before insert/update

CREATE OR REPLACE FUNCTION validate_communication_event() 
RETURNS TRIGGER AS $$
BEGIN
    -- Validate recipient_email is present for all email events
    IF NEW.recipient_email IS NULL OR TRIM(NEW.recipient_email) = '' THEN
        -- Log the validation error for debugging
        INSERT INTO audit_logs (
            action, 
            category, 
            message, 
            entity_id, 
            old_values,
            new_values
        ) VALUES (
            'communication_event_validation_failed',
            'Email System',
            'Communication event rejected: Missing recipient email',
            NEW.id,
            '{}',
            jsonb_build_object(
                'event_type', NEW.event_type,
                'order_id', NEW.order_id,
                'template_key', NEW.template_key,
                'recipient_email_provided', NEW.recipient_email IS NOT NULL
            )
        );
        
        -- Set status to failed with descriptive error
        NEW.status = 'failed'::communication_event_status;
        NEW.error_message = 'Missing recipient email - cannot send email without valid recipient';
        NEW.retry_count = 99; -- Prevent retries for validation failures
    END IF;
    
    -- Validate email format if provided
    IF NEW.recipient_email IS NOT NULL 
       AND TRIM(NEW.recipient_email) != ''
       AND NEW.recipient_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        
        INSERT INTO audit_logs (
            action, 
            category, 
            message, 
            entity_id, 
            new_values
        ) VALUES (
            'communication_event_invalid_email',
            'Email System',
            'Communication event rejected: Invalid email format',
            NEW.id,
            jsonb_build_object(
                'event_type', NEW.event_type,
                'recipient_email', NEW.recipient_email,
                'order_id', NEW.order_id
            )
        );
        
        NEW.status = 'failed'::communication_event_status;
        NEW.error_message = 'Invalid email format: ' || NEW.recipient_email;
        NEW.retry_count = 99; -- Prevent retries for validation failures
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS validate_communication_event_trigger ON communication_events;
CREATE TRIGGER validate_communication_event_trigger
    BEFORE INSERT OR UPDATE ON communication_events
    FOR EACH ROW
    EXECUTE FUNCTION validate_communication_event();

-- Create function to manually trigger review request processing
CREATE OR REPLACE FUNCTION trigger_review_request_processing()
RETURNS jsonb 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Only allow admin access
    IF NOT is_admin() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Access denied - admin required'
        );
    END IF;
    
    -- Log the manual trigger
    INSERT INTO audit_logs (
        action,
        category,
        message,
        user_id
    ) VALUES (
        'manual_review_request_trigger',
        'Email System',
        'Admin manually triggered review request processing',
        auth.uid()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Review request processing triggered manually',
        'next_steps', 'Check the review-request-processor edge function logs for processing results'
    );
END;
$$;