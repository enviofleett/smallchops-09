
-- Create a new migration to fix the audit log user attribution
-- This function is used by triggers on multiple settings tables
CREATE OR REPLACE FUNCTION public.log_settings_changes()
RETURNS TRIGGER AS $$
DECLARE
  actor_id UUID;
  new_jsonb jsonb;
  old_jsonb jsonb;
BEGIN
  -- Convert row records to jsonb for easier introspection
  IF TG_OP != 'DELETE' THEN
    new_jsonb := to_jsonb(NEW);
  END IF;
  IF TG_OP != 'INSERT' THEN
    old_jsonb := to_jsonb(OLD);
  END IF;

  -- Try to get the user ID from the 'connected_by' column if it exists in the row data.
  -- This is more reliable than auth.uid() when changes are made via edge functions with service keys.
  IF TG_OP = 'DELETE' THEN
    IF old_jsonb ? 'connected_by' THEN
      actor_id := (old_jsonb ->> 'connected_by')::uuid;
    END IF;
  ELSE
    IF new_jsonb ? 'connected_by' THEN
      actor_id := (new_jsonb ->> 'connected_by')::uuid;
    END IF;
  END IF;

  -- Fallback to auth.uid() if 'connected_by' is not available or is null
  IF actor_id IS NULL THEN
    actor_id := auth.uid();
  END IF;
  
  INSERT INTO public.audit_logs (
    user_id,
    action,
    category,
    entity_type,
    entity_id,
    message,
    old_values,
    new_values
  ) VALUES (
    actor_id,
    TG_OP,
    'Settings',
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CONCAT(TG_TABLE_NAME, ' ', TG_OP, ' by user ', COALESCE(actor_id::text, 'system')),
    CASE WHEN TG_OP = 'DELETE' THEN old_jsonb ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN new_jsonb ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

