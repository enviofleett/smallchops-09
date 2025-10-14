-- Function to archive stale communication events
CREATE OR REPLACE FUNCTION archive_stale_communication_events(
  p_age_hours INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archived_count INTEGER := 0;
  v_cutoff_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate cutoff time
  v_cutoff_time := NOW() - (p_age_hours || ' hours')::INTERVAL;
  
  -- Archive stale queued and failed emails
  WITH archived AS (
    INSERT INTO communication_events_archive (
      id, event_type, recipient_email, template_key, template_variables,
      status, order_id, priority, created_at, updated_at, scheduled_at,
      retry_count, error_message, processing_started_at, processing_time_ms,
      sent_at, processed_at, email_provider, email_type, template_id,
      delivery_status, external_id, last_error
    )
    SELECT 
      id, event_type, recipient_email, template_key, template_variables,
      'stale'::communication_event_status,
      order_id, priority, created_at, updated_at, scheduled_at,
      retry_count, error_message, processing_started_at, processing_time_ms,
      sent_at, processed_at, email_provider, email_type, template_id,
      delivery_status, external_id, last_error
    FROM communication_events
    WHERE created_at < v_cutoff_time
      AND status IN ('queued', 'failed', 'processing')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_archived_count FROM archived;
  
  -- Delete archived records from main table
  DELETE FROM communication_events
  WHERE created_at < v_cutoff_time
    AND status IN ('queued', 'failed', 'processing');
  
  -- Log the cleanup action
  INSERT INTO audit_logs (
    action, category, message, new_values
  ) VALUES (
    'stale_emails_archived',
    'Email System',
    'Archived ' || v_archived_count || ' stale communication events',
    jsonb_build_object(
      'archived_count', v_archived_count,
      'cutoff_time', v_cutoff_time,
      'age_hours', p_age_hours
    )
  );
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'archived_count', v_archived_count,
    'cutoff_time', v_cutoff_time,
    'message', 'Successfully archived ' || v_archived_count || ' stale emails'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM,
    'message', 'Failed to archive stale emails'
  );
END;
$$;