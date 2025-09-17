-- Clean up legacy communication events data
UPDATE communication_events 
SET template_key = CASE 
    WHEN event_type LIKE '%order%' AND event_type LIKE '%status%' THEN 'order_status_update'
    WHEN event_type LIKE '%payment%' THEN 'payment_confirmation'
    WHEN event_type LIKE '%welcome%' THEN 'customer_welcome'
    WHEN event_type LIKE '%invitation%' THEN 'admin_invitation'
    WHEN event_type LIKE '%delivery%' THEN 'delivery_completed'
    WHEN event_type LIKE '%promotion%' THEN 'promotion_announcement'
    WHEN event_type LIKE '%menu%' THEN 'new_menu_item'
    ELSE CONCAT('template_', LOWER(REPLACE(event_type, ' ', '_')))
END
WHERE template_key IS NULL OR template_key = '';

-- Remove legacy MailerSend columns if they exist
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'communication_settings' AND column_name = 'mailersend_domain') THEN
        ALTER TABLE communication_settings DROP COLUMN IF EXISTS mailersend_domain;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'communication_settings' AND column_name = 'mailersend_domain_verified') THEN
        ALTER TABLE communication_settings DROP COLUMN IF EXISTS mailersend_domain_verified;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'communication_settings' AND column_name = 'mailersend_api_token') THEN
        ALTER TABLE communication_settings DROP COLUMN IF EXISTS mailersend_api_token;
    END IF;
END $$;

-- Ensure all communication_events have proper status and template_key values
UPDATE communication_events 
SET status = 'failed'
WHERE status NOT IN ('queued', 'processing', 'sent', 'delivered', 'failed', 'bounced');

-- Log cleanup completion
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
    'legacy_cleanup_completed',
    'System Maintenance',
    'Comprehensive legacy email system cleanup completed',
    jsonb_build_object(
        'cleanup_date', now(),
        'actions_performed', jsonb_build_array(
            'template_key_cleanup',
            'mailersend_columns_removed',
            'status_validation',
            'legacy_functions_removed'
        )
    )
);