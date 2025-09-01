
-- Production-ready cleanup for email data: archive + prune stale undelivered items

BEGIN;

-- 1) Archive tables for SMTP logs (JSON snapshot archives)
CREATE TABLE IF NOT EXISTS public.smtp_delivery_logs_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id uuid,
  data jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.smtp_delivery_confirmations_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id uuid,
  data jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

-- Note: communication_events_archive already exists and is used elsewhere (keep using it).

-- 2) Production cleanup function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.cleanup_email_legacy(
  p_dry_run boolean DEFAULT true,
  p_queue_stale_hours integer DEFAULT 2,
  p_queue_cutoff_days integer DEFAULT 1,
  p_fail_log_retention_days integer DEFAULT 7,
  p_sent_log_retention_days integer DEFAULT 30
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stale_processing_ids uuid[];
  v_stale_queued_ids uuid[];
  v_processing_count integer := 0;
  v_queued_count integer := 0;
  v_logs_archived integer := 0;
  v_conf_archived integer := 0;
BEGIN
  -- 2.1 Identify stale 'processing' events (stuck)
  SELECT COALESCE(array_agg(id), '{}') INTO v_stale_processing_ids
  FROM communication_events
  WHERE status = 'processing'
    AND COALESCE(processing_started_at, created_at) < (NOW() - make_interval(hours => p_queue_stale_hours));

  v_processing_count := COALESCE(array_length(v_stale_processing_ids, 1), 0);

  IF NOT p_dry_run AND v_processing_count > 0 THEN
    -- Mark as failed with reason, then archive and delete
    UPDATE communication_events
    SET status = 'failed',
        error_message = COALESCE(error_message, '') || CASE WHEN error_message IS NULL OR error_message = '' THEN '' ELSE ' | ' END
                       || 'auto-cleanup: stuck processing > ' || p_queue_stale_hours || 'h',
        retry_count = retry_count + 1,
        updated_at = NOW()
    WHERE id = ANY (v_stale_processing_ids);

    INSERT INTO communication_events_archive
    SELECT * FROM communication_events WHERE id = ANY (v_stale_processing_ids);

    DELETE FROM communication_events WHERE id = ANY (v_stale_processing_ids);
  END IF;

  -- 2.2 Identify stale 'queued' events (expired)
  SELECT COALESCE(array_agg(id), '{}') INTO v_stale_queued_ids
  FROM communication_events
  WHERE status = 'queued'
    AND created_at < (NOW() - make_interval(days => p_queue_cutoff_days));

  v_queued_count := COALESCE(array_length(v_stale_queued_ids, 1), 0);

  IF NOT p_dry_run AND v_queued_count > 0 THEN
    -- Mark as failed with reason, then archive and delete
    UPDATE communication_events
    SET status = 'failed',
        error_message = COALESCE(error_message, '') || CASE WHEN error_message IS NULL OR error_message = '' THEN '' ELSE ' | ' END
                       || 'auto-cleanup: expired queued > ' || p_queue_cutoff_days || 'd',
        retry_count = retry_count + 1,
        updated_at = NOW()
    WHERE id = ANY (v_stale_queued_ids);

    INSERT INTO communication_events_archive
    SELECT * FROM communication_events WHERE id = ANY (v_stale_queued_ids);

    DELETE FROM communication_events WHERE id = ANY (v_stale_queued_ids);
  END IF;

  -- 2.3 Archive/prune SMTP delivery logs: non-delivered older than p_fail_log_retention_days
  IF NOT p_dry_run THEN
    WITH to_archive AS (
      SELECT id FROM smtp_delivery_logs
      WHERE (delivery_status IS NULL OR delivery_status NOT IN ('delivered','sent'))
        AND COALESCE(delivery_timestamp::timestamptz, created_at) < (NOW() - make_interval(days => p_fail_log_retention_days))
    )
    INSERT INTO smtp_delivery_logs_archive (original_id, data)
    SELECT l.id, to_jsonb(l.*) FROM smtp_delivery_logs l
    WHERE l.id IN (SELECT id FROM to_archive);

    GET DIAGNOSTICS v_logs_archived = ROW_COUNT;

    DELETE FROM smtp_delivery_logs
    WHERE id IN (SELECT id FROM to_archive);
  END IF;

  -- 2.4 Archive/prune SMTP delivery confirmations: not 'sent' older than p_fail_log_retention_days
  IF NOT p_dry_run THEN
    WITH to_archive AS (
      SELECT id FROM smtp_delivery_confirmations
      WHERE (delivery_status IS NULL OR delivery_status <> 'sent')
        AND created_at < (NOW() - make_interval(days => p_fail_log_retention_days))
    )
    INSERT INTO smtp_delivery_confirmations_archive (original_id, data)
    SELECT c.id, to_jsonb(c.*) FROM smtp_delivery_confirmations c
    WHERE c.id IN (SELECT id FROM to_archive);

    GET DIAGNOSTICS v_conf_archived = ROW_COUNT;

    DELETE FROM smtp_delivery_confirmations
    WHERE id IN (SELECT id FROM to_archive);
  END IF;

  -- 2.5 Apply existing retention cleanup for old 'sent' confirmations and health metrics
  IF NOT p_dry_run THEN
    PERFORM public.cleanup_old_email_logs();
  END IF;

  -- 2.6 Log audit
  IF NOT p_dry_run THEN
    INSERT INTO audit_logs (action, category, message, new_values)
    VALUES (
      'email_cleanup_executed',
      'System Maintenance',
      'Automated cleanup: stale pending/undelivered items archived and pruned',
      jsonb_build_object(
        'stuck_processing_archived', v_processing_count,
        'stale_queued_archived', v_queued_count,
        'smtp_logs_archived', v_logs_archived,
        'smtp_confirmations_archived', v_conf_archived,
        'queue_stale_hours', p_queue_stale_hours,
        'queue_cutoff_days', p_queue_cutoff_days,
        'fail_log_retention_days', p_fail_log_retention_days,
        'sent_log_retention_days', p_sent_log_retention_days
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'stuck_processing_found', v_processing_count,
    'stale_queued_found', v_queued_count,
    'smtp_logs_archived', v_logs_archived,
    'smtp_confirmations_archived', v_conf_archived,
    'timestamp', NOW()
  );
END;
$function$;

-- 3) Execute an immediate non-dry-run cleanup (safe defaults)
-- Adjust parameters if you want stricter cleanup; defaults: processing > 2h, queued > 1d, fail logs > 7d
SELECT public.cleanup_email_legacy(p_dry_run := false);

COMMIT;
