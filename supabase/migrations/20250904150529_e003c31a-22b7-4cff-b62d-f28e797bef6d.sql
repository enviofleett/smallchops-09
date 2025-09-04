
-- Safe go-live reset function: previews and selectively clears operational data
-- IMPORTANT:
-- - dry_run=true by default (no deletion)
-- - reset_sequences=false by default (IDs not reset)
-- - include_audit_logs=false by default (audit logs kept)

create or replace function public.reset_for_go_live(
  p_dry_run boolean default true,
  p_reset_sequences boolean default false,
  p_include_audit_logs boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  -- Child-first deletion order to honor FK constraints
  v_child_tables text[] := array[
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
  v_parent_tables text[] := array[
    'orders'
  ];

  v_table text;
  v_affected_counts jsonb := '{}'::jsonb;
  v_count bigint := 0;
  v_total_deleted jsonb := '{}'::jsonb;

  -- helper to check table existence
  function table_exists(p_table text) returns boolean
  as $f$
  begin
    return to_regclass('public.'||p_table) is not null;
  end;
  $f$ language plpgsql;

begin
  -- 1) Preview counts for all targeted tables (both child and parent lists)
  foreach v_table in array array_cat(v_child_tables, v_parent_tables) loop
    if table_exists(v_table) then
      execute format('select count(*) from %I', v_table) into v_count;
      v_affected_counts := v_affected_counts || jsonb_build_object(v_table, v_count);
    end if;
  end loop;

  if p_dry_run then
    return jsonb_build_object(
      'dry_run', true,
      'affected_counts', v_affected_counts,
      'note', 'No data deleted. Set p_dry_run=false to perform cleanup.'
    );
  end if;

  -- 2) Perform deletes in safe order (children first)
  foreach v_table in array v_child_tables loop
    if table_exists(v_table) then
      execute format('delete from %I', v_table);
    end if;
  end loop;

  foreach v_table in array v_parent_tables loop
    if table_exists(v_table) then
      execute format('delete from %I', v_table);
    end if;
  end loop;

  -- 3) Optionally reset sequences (only for integer identity/serial columns)
  if p_reset_sequences then
    -- Reset sequences for known tables where resetting IDs is safe
    -- Note: UUID-based IDs are unaffected by sequence resets.
    -- Use identity resets where applicable; ignore if none.
    perform
      case when table_exists('orders') then
        (select 1 from pg_catalog.pg_sequences s
         where s.schemaname='public' and s.sequencename ilike 'orders%') end;

    -- Generic reset for all affected tables that have a sequence on column "id"
    for v_table in
      select tname
      from (
        select unnest(array_cat(v_child_tables, v_parent_tables)) as tname
      ) q
      where table_exists(q.tname)
    loop
      -- Try to reset sequence tied to "id" if present; ignore errors for UUID/no-sequence tables
      begin
        perform setval(pg_get_serial_sequence(format('%I', v_table), 'id'), 1, false);
      exception when others then
        -- no serial/identity sequence; safe to ignore
        null;
      end;
    end loop;
  end if;

  -- 4) Optionally clear audit logs (off by default)
  if p_include_audit_logs and table_exists('audit_logs') then
    execute 'delete from audit_logs';
  end if;

  -- 5) Optional consistency tweak: clear last_order_date on customers, if present
  if table_exists('customer_accounts') then
    update customer_accounts set last_order_date = null;
  end if;

  -- 6) Record audit trail of the reset itself
  if table_exists('audit_logs') then
    insert into audit_logs(action, category, message, new_values)
    values(
      'go_live_reset',
      'System Maintenance',
      'Cleared order, email logs, and reports data for production go-live',
      jsonb_build_object(
        'affected_counts_at_start', v_affected_counts,
        'include_audit_logs', p_include_audit_logs,
        'reset_sequences', p_reset_sequences,
        'executed_at', now()
      )
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'deleted_started_counts', v_affected_counts,
    'message', 'Operational data cleared successfully. Customer and configuration data preserved.'
  );
end;
$$;
