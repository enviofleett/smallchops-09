-- Phase 2: Production Hardening - Migration 05: Archive Table and Function
-- Create a simple archive table (schema copy)
CREATE TABLE IF NOT EXISTS communication_events_archive (LIKE communication_events INCLUDING ALL);

-- Create a function to archive old communication events
CREATE OR REPLACE FUNCTION archive_old_communication_events() RETURNS INT LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  rows_moved INT;
BEGIN
  INSERT INTO communication_events_archive
  SELECT * FROM communication_events
  WHERE status = 'sent' AND created_at < NOW() - INTERVAL '30 days';

  DELETE FROM communication_events
  WHERE status = 'sent' AND created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS rows_moved = ROW_COUNT;
  RETURN rows_moved;
END;
$$;