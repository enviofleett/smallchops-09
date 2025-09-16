-- Emergency Stabilization: Fix communication_events dedupe key generation
-- This prevents duplicate key violations that are causing 500 errors

-- Add unique constraint on dedupe_key to prevent duplicates (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'communication_events_dedupe_key_unique'
    ) THEN
        ALTER TABLE communication_events 
        ADD CONSTRAINT communication_events_dedupe_key_unique UNIQUE (dedupe_key);
    END IF;
END $$;

-- Create improved dedupe key generation function
CREATE OR REPLACE FUNCTION generate_communication_dedupe_key(
  p_event_type text,
  p_recipient_email text,
  p_order_id uuid DEFAULT NULL,
  p_template_key text DEFAULT NULL
) 
RETURNS text 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dedupe_components text[];
  time_window text;
BEGIN
  -- Create time window (hour-based) to prevent spam while allowing legitimate retries
  time_window := to_char(date_trunc('hour', now()), 'YYYY-MM-DD-HH24');
  
  -- Build dedupe key components
  dedupe_components := ARRAY[
    p_event_type,
    lower(trim(p_recipient_email)),
    time_window
  ];
  
  -- Add order_id if provided (for order-specific events)
  IF p_order_id IS NOT NULL THEN
    dedupe_components := dedupe_components || ARRAY[p_order_id::text];
  END IF;
  
  -- Add template_key if provided (for template-specific events)
  IF p_template_key IS NOT NULL THEN
    dedupe_components := dedupe_components || ARRAY[p_template_key];
  END IF;
  
  -- Generate SHA256 hash of components for consistent, collision-resistant key
  RETURN encode(
    digest(array_to_string(dedupe_components, '|'), 'sha256'), 
    'hex'
  );
END;
$$;

-- Update existing records with proper dedupe keys (only for recent records to avoid timeout)
UPDATE communication_events 
SET dedupe_key = generate_communication_dedupe_key(
  event_type,
  recipient_email,
  order_id,
  template_key
)
WHERE dedupe_key IS NULL 
  AND created_at > now() - interval '7 days';

-- Add trigger to automatically generate dedupe key on insert
CREATE OR REPLACE FUNCTION trigger_generate_communication_dedupe_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only generate if not already provided
  IF NEW.dedupe_key IS NULL THEN
    NEW.dedupe_key := generate_communication_dedupe_key(
      NEW.event_type,
      NEW.recipient_email,
      NEW.order_id,
      NEW.template_key
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS communication_events_dedupe_key_trigger ON communication_events;
CREATE TRIGGER communication_events_dedupe_key_trigger
  BEFORE INSERT ON communication_events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_communication_dedupe_key();

-- Add index for better performance on dedupe key lookups
CREATE INDEX IF NOT EXISTS idx_communication_events_dedupe_key 
ON communication_events (dedupe_key);

-- Fix is_admin function to be production-ready
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  user_active boolean;
BEGIN
  -- Get the current user's role and active status
  SELECT role, is_active INTO user_role, user_active
  FROM profiles
  WHERE id = auth.uid();
  
  -- Return true if user is admin and active
  RETURN COALESCE(user_role = 'admin' AND user_active = true, false);
EXCEPTION
  WHEN OTHERS THEN
    -- Return false on any error (security-first approach)
    RETURN false;
END;
$$;