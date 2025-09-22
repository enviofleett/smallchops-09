-- Set up a scheduled job to process email notifications every minute
SELECT cron.schedule(
    'process-email-notifications',
    '* * * * *', -- Every minute
    $$
    SELECT net.http_post(
        url := 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/email-notification-cron',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzE5MDkxNCwiZXhwIjoyMDY4NzY2OTE0fQ.kHgI_63BCKGg6L1peF_Oi9zOIlpFniC1N6jTtKj6U1g"}'::jsonb,
        body := '{"trigger": "cron"}'::jsonb
    ) AS request_id;
    $$
);

-- Also create a manual trigger function for testing
CREATE OR REPLACE FUNCTION trigger_email_processing()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Get stats before processing
    SELECT jsonb_build_object(
        'pending', COUNT(*) FILTER (WHERE processed_at IS NULL AND retry_count < 3),
        'failed', COUNT(*) FILTER (WHERE processed_at IS NULL AND retry_count >= 3),
        'total', COUNT(*)
    ) INTO result
    FROM order_status_notifications;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Email processing can be triggered manually via the admin UI',
        'queue_stats', result,
        'manual_trigger_available', true
    );
END;
$$;

-- Create a function to get email queue stats for monitoring
CREATE OR REPLACE FUNCTION get_email_queue_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    stats jsonb;
    recent_activity jsonb;
BEGIN
    -- Get queue statistics
    SELECT jsonb_build_object(
        'pending', COUNT(*) FILTER (WHERE processed_at IS NULL AND retry_count < 3),
        'processing', 0, -- We don't track processing state currently
        'sent', COUNT(*) FILTER (WHERE processed_at IS NOT NULL),
        'failed', COUNT(*) FILTER (WHERE processed_at IS NULL AND retry_count >= 3),
        'total', COUNT(*),
        'last_hour_sent', COUNT(*) FILTER (WHERE processed_at > NOW() - INTERVAL '1 hour'),
        'last_hour_failed', COUNT(*) FILTER (WHERE retry_count > 0 AND created_at > NOW() - INTERVAL '1 hour')
    ) INTO stats
    FROM order_status_notifications;
    
    -- Get recent activity (last 10 notifications)
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'order_number', order_number,
            'status', new_status,
            'customer_email', customer_email,
            'created_at', created_at,
            'processed_at', processed_at,
            'retry_count', retry_count,
            'success', processed_at IS NOT NULL
        )
        ORDER BY created_at DESC
    ) INTO recent_activity
    FROM (
        SELECT * FROM order_status_notifications 
        ORDER BY created_at DESC 
        LIMIT 10
    ) recent;
    
    RETURN jsonb_build_object(
        'stats', stats,
        'recent_activity', COALESCE(recent_activity, '[]'::jsonb),
        'system_healthy', (stats->>'failed')::int < 10,
        'last_updated', NOW()
    );
END;
$$;