-- Clean up legacy communication events data (corrected enum values)
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

-- Mark any invalid status entries as failed (using only valid enum values)
UPDATE communication_events 
SET status = 'failed'
WHERE status NOT IN ('queued', 'processing', 'sent', 'failed');

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
            'status_validation',
            'legacy_functions_removed'
        )
    )
);