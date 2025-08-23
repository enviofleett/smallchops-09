-- Email Queue Purge Migration
-- This migration script purges all queued and processing emails to prepare for SMTP-only email system
-- Run this after completing the email system refactoring to SMTP-only

-- Purpose: Clean up all pending emails that were in queue before SMTP-only migration
-- These emails may have been scheduled with old email senders that are no longer available

BEGIN;

-- Log the migration start
INSERT INTO email_migration_logs (migration_name, started_at, description) 
VALUES (
  'purge-email-queue-for-smtp-only', 
  NOW(), 
  'Purging all queued and processing emails before switching to SMTP-only system'
);

-- Count emails to be purged for logging
WITH purge_counts AS (
  SELECT 
    status,
    COUNT(*) as count
  FROM communication_events 
  WHERE status IN ('queued', 'processing')
  GROUP BY status
)
INSERT INTO email_migration_logs (migration_name, started_at, metadata)
SELECT 
  'purge-email-queue-for-smtp-only',
  NOW(),
  json_build_object(
    'emails_to_purge', json_object_agg(status, count),
    'total_count', SUM(count)
  )
FROM purge_counts;

-- Archive the emails that will be purged (for potential recovery)
INSERT INTO email_archive (
  original_id,
  recipient_email,
  template_key,
  variables,
  priority,
  status,
  retry_count,
  error_message,
  created_at,
  scheduled_at,
  archived_at,
  archive_reason
)
SELECT 
  id,
  recipient_email,
  template_key,
  template_variables,
  priority,
  status,
  retry_count,
  error_message,
  created_at,
  scheduled_at,
  NOW(),
  'Purged during SMTP-only migration'
FROM communication_events 
WHERE status IN ('queued', 'processing');

-- Delete all queued and processing emails
DELETE FROM communication_events 
WHERE status IN ('queued', 'processing');

-- Reset auto-increment sequences if needed (PostgreSQL)
-- This ensures clean ID sequence after purge
SELECT setval(
  pg_get_serial_sequence('communication_events', 'id'), 
  COALESCE(MAX(id), 0) + 1, 
  false
) 
FROM communication_events;

-- Log the completion
INSERT INTO email_migration_logs (migration_name, completed_at, success, description)
VALUES (
  'purge-email-queue-for-smtp-only',
  NOW(),
  true,
  'Successfully purged all queued and processing emails. System ready for SMTP-only operation.'
);

-- Create a summary report
WITH migration_summary AS (
  SELECT 
    COUNT(CASE WHEN archive_reason = 'Purged during SMTP-only migration' THEN 1 END) as archived_count,
    COUNT(CASE WHEN status NOT IN ('queued', 'processing') THEN 1 END) as remaining_count
  FROM email_archive ea
  FULL OUTER JOIN communication_events ce ON true
)
INSERT INTO email_migration_logs (migration_name, completed_at, metadata)
SELECT 
  'purge-email-queue-for-smtp-only',
  NOW(),
  json_build_object(
    'emails_archived', archived_count,
    'emails_remaining_in_queue', remaining_count,
    'migration_status', 'completed_successfully'
  )
FROM migration_summary;

COMMIT;

-- Verification queries (run these after migration to verify success)
/*
-- Verify no queued/processing emails remain
SELECT status, COUNT(*) 
FROM communication_events 
WHERE status IN ('queued', 'processing')
GROUP BY status;

-- Verify archived emails count
SELECT COUNT(*) as archived_emails
FROM email_archive 
WHERE archive_reason = 'Purged during SMTP-only migration';

-- Check migration logs
SELECT * FROM email_migration_logs 
WHERE migration_name = 'purge-email-queue-for-smtp-only'
ORDER BY started_at DESC;
*/