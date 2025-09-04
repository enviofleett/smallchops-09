-- Safe go-live reset function: previews and selectively clears operational data
-- IMPORTANT:
-- - dry_run=true by default (no deletion)
-- - reset_sequences=false by default (IDs not reset)  
-- - include_audit_logs=false by default (audit logs kept)

CREATE OR REPLACE FUNCTION public.reset_for_go_live(
  p_dry_run boolean DEFAULT true,
  p_reset_sequences boolean DEFAULT false,
  p_include_audit_logs boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  -- Child-first deletion order to honor FK constraints
  v_child_tables text[] := ARRAY[
    'order_status_changes',
    'order_delivery_schedule', 
    'order_assignments',
    'delivery_assignments',
    'bogo_allocations',
    'deliveries',
    'order_items',
    'payment_transactions',
    'transaction_analytics',
    'business_analytics',
    'api_metrics',
    'api_request_logs',
    'cron_execution_logs',
    'automation_activity_logs',
    'cart_sessions',
    'cart_abandonment_tracking',
    'communication_logs',
    'communication_events',
    'communication_events_archive',
    'smtp_delivery_logs',
    'smtp_delivery_confirmations'
  ];

  -- Parent tables after children are cleared
  v_parent_tables text[] := ARRAY['orders'];

  v_table text;
  v_affected_counts jsonb := '{}'::jsonb;
  v_count bigint := 0;
BEGIN
  -- 1) Preview counts for all targeted tables (both child and parent lists)
  FOR v_table IN SELECT unnest(array_cat(v_child_tables, v_parent_tables))
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_table) THEN
      EXECUTE format('SELECT count(*) FROM %I', v_table) INTO v_count;
      v_affected_counts := v_affected_counts || jsonb_build_object(v_table, v_count);
    END IF;
  END LOOP;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'affected_counts', v_affected_counts,
      'note', 'No data deleted. Set p_dry_run=false to perform cleanup.'
    );
  END IF;

  -- 2) Perform deletes in safe order (children first)
  FOR v_table IN SELECT unnest(v_child_tables)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_table) THEN
      EXECUTE format('DELETE FROM %I', v_table);
    END IF;
  END LOOP;

  FOR v_table IN SELECT unnest(v_parent_tables)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_table) THEN
      EXECUTE format('DELETE FROM %I', v_table);
    END IF;
  END LOOP;

  -- 3) Optionally reset sequences (only for integer identity/serial columns)
  IF p_reset_sequences THEN
    -- Generic reset for all affected tables that have a sequence on column "id"
    FOR v_table IN SELECT unnest(array_cat(v_child_tables, v_parent_tables))
    LOOP
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_table) THEN
        -- Try to reset sequence tied to "id" if present; ignore errors for UUID/no-sequence tables
        BEGIN
          PERFORM setval(pg_get_serial_sequence(format('public.%I', v_table), 'id'), 1, false);
        EXCEPTION WHEN OTHERS THEN
          -- no serial/identity sequence; safe to ignore
          NULL;
        END;
      END IF;
    END LOOP;
  END IF;

  -- 4) Optionally clear audit logs (off by default)
  IF p_include_audit_logs AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    DELETE FROM audit_logs;
  END IF;

  -- 5) Optional consistency tweak: clear last_order_date on customers, if present
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_accounts') THEN
    UPDATE customer_accounts SET last_order_date = NULL;
  END IF;

  -- 6) Record audit trail of the reset itself
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    INSERT INTO audit_logs(action, category, message, new_values)
    VALUES(
      'go_live_reset',
      'System Maintenance', 
      'Cleared order, email logs, and reports data for production go-live',
      jsonb_build_object(
        'affected_counts_at_start', v_affected_counts,
        'include_audit_logs', p_include_audit_logs,
        'reset_sequences', p_reset_sequences,
        'executed_at', NOW()
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_started_counts', v_affected_counts,
    'message', 'Operational data cleared successfully. Customer and configuration data preserved.'
  );
END;
$$;