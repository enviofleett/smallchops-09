-- Phase 1: Apply SQL migrations for SMTP system hardening
-- This migration adds required tables, indexes, and triggers for enhanced SMTP security and monitoring

-- 1. SMTP Provider Configurations (Update existing table to match requirements)
-- The table already exists but may need schema adjustments
DO $$
BEGIN
    -- Add missing columns to existing smtp_provider_configs if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'smtp_provider_configs' 
                   AND column_name = 'provider_name') THEN
        ALTER TABLE smtp_provider_configs ADD COLUMN provider_name TEXT;
        UPDATE smtp_provider_configs SET provider_name = name WHERE provider_name IS NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'smtp_provider_configs' 
                   AND column_name = 'status') THEN
        ALTER TABLE smtp_provider_configs ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'smtp_provider_configs' 
                   AND column_name = 'suspended_until') THEN
        ALTER TABLE smtp_provider_configs ADD COLUMN suspended_until TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'smtp_provider_configs' 
                   AND column_name = 'credentials') THEN
        ALTER TABLE smtp_provider_configs ADD COLUMN credentials JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'smtp_provider_configs' 
                   AND column_name = 'last_checked') THEN
        ALTER TABLE smtp_provider_configs ADD COLUMN last_checked TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- 2. SMTP Connection Audit (Update existing table to match requirements)
DO $$
BEGIN
    -- Add missing columns to existing smtp_connection_audit if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'smtp_connection_audit' 
                   AND column_name = 'provider_name') THEN
        ALTER TABLE smtp_connection_audit ADD COLUMN provider_name TEXT NOT NULL DEFAULT 'unknown';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'smtp_connection_audit' 
                   AND column_name = 'connection_attempt_at') THEN
        ALTER TABLE smtp_connection_audit ADD COLUMN connection_attempt_at TIMESTAMP NOT NULL DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'smtp_connection_audit' 
                   AND column_name = 'ip_address') THEN
        ALTER TABLE smtp_connection_audit ADD COLUMN ip_address TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'smtp_connection_audit' 
                   AND column_name = 'result') THEN
        ALTER TABLE smtp_connection_audit ADD COLUMN result TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'smtp_connection_audit' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE smtp_connection_audit ADD COLUMN updated_at TIMESTAMP;
    END IF;
END $$;

-- 3. SMTP Delivery Confirmations (Update existing table to match requirements) 
DO $$
BEGIN
    -- Ensure smtp_delivery_confirmations has required columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'smtp_delivery_confirmations' 
                   AND column_name = 'provider_name') THEN
        ALTER TABLE smtp_delivery_confirmations ADD COLUMN provider_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'smtp_delivery_confirmations' 
                   AND column_name = 'message_id') THEN
        ALTER TABLE smtp_delivery_confirmations ADD COLUMN message_id TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'smtp_delivery_confirmations' 
                   AND column_name = 'status') THEN
        ALTER TABLE smtp_delivery_confirmations ADD COLUMN status TEXT;
    END IF;
END $$;

-- 4. Rate Limit Counters (New table)
CREATE TABLE IF NOT EXISTS rate_limit_counters (
    id SERIAL PRIMARY KEY,
    identifier TEXT NOT NULL,
    identifier_type TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMP NOT NULL DEFAULT NOW(),
    reputation_score INTEGER NOT NULL DEFAULT 100
);

-- 5. Indexes for communication_events (add missing indexes)
CREATE INDEX IF NOT EXISTS idx_communication_events_status_priority_retry_scheduled
    ON communication_events (status, priority, retry_count, scheduled_at, created_at);

-- Only create recipient_email index if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'communication_events' 
                   AND indexname = 'idx_communication_events_recipient_email') THEN
        CREATE INDEX idx_communication_events_recipient_email
            ON communication_events (recipient_email);
    END IF;
END $$;

-- Only create template_key index if it doesn't exist  
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'communication_events' 
                   AND indexname = 'idx_communication_events_template_key') THEN
        CREATE INDEX idx_communication_events_template_key
            ON communication_events (template_key);
    END IF;
END $$;

-- 6. Indexes for audit tables
CREATE INDEX IF NOT EXISTS idx_smtp_connection_audit_provider_attempt
    ON smtp_connection_audit (provider_name, connection_attempt_at);
CREATE INDEX IF NOT EXISTS idx_smtp_delivery_confirmations_recipient_created
    ON smtp_delivery_confirmations (recipient_email, created_at);

-- 7. Validation Trigger for communication_events
CREATE OR REPLACE FUNCTION enforce_communication_event_validity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.recipient_email IS NULL OR NEW.recipient_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        NEW.status := 'failed';
        NEW.last_error := 'Invalid recipient_email';
        RETURN NEW;
    END IF;
    IF NEW.template_key IS NULL OR NEW.event_type IS NULL THEN
        NEW.status := 'failed';
        NEW.last_error := 'Missing template_key or event_type';
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_communication_event ON communication_events;
CREATE TRIGGER validate_communication_event
    BEFORE INSERT OR UPDATE ON communication_events
    FOR EACH ROW EXECUTE FUNCTION enforce_communication_event_validity();

-- 8. pg_cron jobs (commented out as they are environment-specific)
-- These jobs should be configured in the production environment:

-- Email queue processor (every minute)
-- SELECT cron.schedule('process_email_queue', '* * * * *', $$
--   SELECT net.http_post(
--     url := 'https://your-domain.supabase.co/functions/v1/process-communication-events-enhanced',
--     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body := '{"action": "process_all_priorities"}'::jsonb
--   );
-- $$);

-- SMTP health monitor (every 5 minutes)  
-- SELECT cron.schedule('monitor_smtp_health', '*/5 * * * *', $$
--   SELECT net.http_post(
--     url := 'https://your-domain.supabase.co/functions/v1/smtp-health-monitor',
--     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
--   );
-- $$);

-- Email production monitor (every 5 minutes)
-- SELECT cron.schedule('monitor_email_production', '*/5 * * * *', $$
--   SELECT net.http_post(
--     url := 'https://your-domain.supabase.co/functions/v1/email-production-monitor', 
--     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
--   );
-- $$);

-- Email health snapshots (daily at midnight)
-- SELECT cron.schedule('snapshot_email_health', '0 0 * * *', $$
--   INSERT INTO email_health_snapshots (
--     timeframe_hours, total_sent, total_delivered, total_failed, 
--     delivery_rate, failure_rate, healthy_providers
--   )
--   SELECT 
--     24 as timeframe_hours,
--     COUNT(CASE WHEN status = 'sent' THEN 1 END) as total_sent,
--     COUNT(CASE WHEN status = 'delivered' THEN 1 END) as total_delivered, 
--     COUNT(CASE WHEN status = 'failed' THEN 1 END) as total_failed,
--     ROUND(COUNT(CASE WHEN status = 'delivered' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as delivery_rate,
--     ROUND(COUNT(CASE WHEN status = 'failed' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as failure_rate,
--     (SELECT COUNT(*) FROM smtp_provider_configs WHERE is_active = true AND health_score >= 80) as healthy_providers
--   FROM communication_events 
--   WHERE created_at >= NOW() - INTERVAL '24 hours';
-- $$);

-- 9. Enable RLS on new table
ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for rate_limit_counters
CREATE POLICY "Admins can manage rate limit counters" 
    ON rate_limit_counters 
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Service roles can manage rate limit counters" 
    ON rate_limit_counters 
    FOR ALL 
    USING (auth.role() = 'service_role');

-- 10. Add comments for documentation
COMMENT ON TABLE smtp_provider_configs IS 'SMTP provider configurations for multi-provider fallback and monitoring';
COMMENT ON TABLE smtp_connection_audit IS 'Audit log for SMTP connection attempts and results';  
COMMENT ON TABLE smtp_delivery_confirmations IS 'Delivery confirmation tracking for sent emails';
COMMENT ON TABLE rate_limit_counters IS 'Rate limiting counters for email sending and API usage';

COMMENT ON FUNCTION enforce_communication_event_validity() IS 'Validation trigger function for communication events to ensure data integrity';

-- Migration complete - SMTP system hardening applied