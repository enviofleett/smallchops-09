-- Dynamic go-live reset that only processes existing tables
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
  -- Build list of tables to clear dynamically
  v_target_tables text[] := ARRAY[
    'order_status_changes',
    'order_delivery_schedule', 
    'delivery_assignments',
    'order_items',
    'payment_transactions',
    'business_analytics',
    'api_metrics',
    'api_request_logs',
    'cron_execution_logs',
    'automation_activity_logs',
    'cart_sessions',
    'cart_abandonment_tracking',
    'communication_events',
    'communication_events_archive',
    'communication_logs',
    'smtp_delivery_logs',
    'smtp_delivery_confirmations',
    'transaction_analytics',
    'orders' -- Last to maintain FK constraints
  ];

  v_existing_tables text[] := '{}';
  v_table text;
  v_affected_counts jsonb := '{}'::jsonb;
  v_count bigint := 0;
BEGIN
  -- 1) Build list of tables that actually exist
  FOR v_table IN SELECT unnest(v_target_tables)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_table) THEN
      v_existing_tables := array_append(v_existing_tables, v_table);
      EXECUTE format('SELECT count(*) FROM %I', v_table) INTO v_count;
      v_affected_counts := v_affected_counts || jsonb_build_object(v_table, v_count);
    END IF;
  END LOOP;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'existing_tables', array_to_json(v_existing_tables),
      'affected_counts', v_affected_counts,
      'note', 'No data deleted. Set p_dry_run=false to perform cleanup.'
    );
  END IF;

  -- 2) Delete data from existing tables (orders last due to FK constraints)
  FOR v_table IN SELECT unnest(v_existing_tables)
  LOOP
    EXECUTE format('DELETE FROM %I', v_table);
  END LOOP;

  -- 3) Clear last_order_date on customers for consistency
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_accounts') THEN
    UPDATE customer_accounts SET last_order_date = NULL;
  END IF;

  -- 4) Record audit trail
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    INSERT INTO audit_logs(action, category, message, new_values)
    VALUES(
      'go_live_reset',
      'System Maintenance', 
      'Production go-live: Cleared all operational data successfully',
      jsonb_build_object(
        'tables_cleared', array_to_json(v_existing_tables),
        'affected_counts', v_affected_counts,
        'executed_at', NOW()
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'tables_cleared', array_to_json(v_existing_tables),
    'deleted_counts', v_affected_counts,
    'message', '🚀 Production ready! All operational data cleared successfully. Customer and configuration data preserved.'
  );
END;
$$;