
-- Archive-and-reset communication_settings to allow a fresh configuration from the Settings page

BEGIN;

-- 1) Create archive table for safe backup (id here is an archive id; original_id references original row)
CREATE TABLE IF NOT EXISTS public.communication_settings_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id uuid,
  data jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Archive current rows
INSERT INTO public.communication_settings_archive (original_id, data, archived_at)
SELECT cs.id, to_jsonb(cs.*), now()
FROM public.communication_settings cs;

-- 3) Clear the table completely
-- Using DELETE instead of TRUNCATE to avoid issues with potential permissions/locks
WITH deleted AS (
  DELETE FROM public.communication_settings
  RETURNING 1
)
SELECT 1;

-- 4) Log operation into audit_logs
-- RLS is bypassed in migration context; this will record the reset for traceability.
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'communication_settings_reset',
  'System Maintenance',
  'All communication_settings rows archived and cleared to allow fresh SMTP configuration via Settings page',
  jsonb_build_object(
    'archived_rows', (SELECT COUNT(*) FROM public.communication_settings_archive WHERE archived_at > now() - interval '5 minutes'),
    'cleared_table', 'communication_settings',
    'note', 'No function secrets were modified'
  )
);

COMMIT;
