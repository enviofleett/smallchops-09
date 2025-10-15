-- ============================================================================
-- PERMANENTLY STOP SPAM EMAILS
-- ============================================================================
-- 1. Delete all communication events with null/invalid template_keys
-- 2. Add constraint to prevent future null template_keys
-- ============================================================================

DO $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'STARTING SPAM EMAIL PREVENTION';
  RAISE NOTICE '============================================================================';
  
  -- Delete all queued events with null or invalid template_keys
  WITH deleted AS (
    DELETE FROM communication_events 
    WHERE template_key IS NULL 
      OR template_key = ''
      OR template_key = 'default_notification'
      OR template_key = 'null'
    RETURNING id, event_type, recipient_email, template_key
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RAISE NOTICE '✅ Deleted % spam communication events with invalid template_keys', deleted_count;
  
  -- Log the cleanup
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'spam_email_cleanup',
    'Email System',
    'Deleted spam communication events with null/invalid template_keys',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'timestamp', NOW()
    )
  );
  
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ SPAM EMAIL PREVENTION COMPLETE';
  RAISE NOTICE '   - Deleted invalid communication events';  
  RAISE NOTICE '   - Adding constraint to prevent future invalid template_keys...';
  RAISE NOTICE '============================================================================';
  
END $$;

-- Add check constraint to prevent null template_keys in future
ALTER TABLE communication_events 
DROP CONSTRAINT IF EXISTS communication_events_valid_template_key;

ALTER TABLE communication_events
ADD CONSTRAINT communication_events_valid_template_key
CHECK (
  template_key IS NOT NULL 
  AND template_key != '' 
  AND template_key != 'null'
  AND template_key != 'default_notification'
);

-- Add helpful comment
COMMENT ON CONSTRAINT communication_events_valid_template_key ON communication_events IS 
'Prevents creation of communication events with null or invalid template keys that would trigger spam fallback emails';