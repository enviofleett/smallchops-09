
-- 1) Guardrail: validate recipient email on communication_events
CREATE OR REPLACE FUNCTION public.validate_communication_event_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Normalize email to lower-case
  IF NEW.recipient_email IS NOT NULL THEN
    NEW.recipient_email := LOWER(BTRIM(NEW.recipient_email));
  END IF;

  -- Basic email format validation (case-insensitive)
  -- If missing or invalid, mark event as failed and annotate error_message
  IF NEW.recipient_email IS NULL
     OR BTRIM(NEW.recipient_email) = ''
     OR NOT (NEW.recipient_email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$') THEN
    NEW.status := 'failed';
    NEW.error_message := CONCAT_WS(
      ' | ',
      NULLIF(COALESCE(NEW.error_message, ''), ''),
      'Invalid or missing recipient_email'
    );
    NEW.updated_at := NOW();
  END IF;

  RETURN NEW;
END;
$function$;

-- Re-create the trigger to ensure it exists and uses the latest function
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_validate_communication_event_recipient'
  ) THEN
    DROP TRIGGER trg_validate_communication_event_recipient ON public.communication_events;
  END IF;

  CREATE TRIGGER trg_validate_communication_event_recipient
  BEFORE INSERT OR UPDATE ON public.communication_events
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_communication_event_recipient();
END;
$$;

-- 2) Backfill: populate recipient_email for queued/processing events using orders.customer_email where available
UPDATE public.communication_events AS ce
SET
  recipient_email = LOWER(BTRIM(o.customer_email)),
  updated_at = NOW(),
  error_message = NULLIF(NULL, NULL)
FROM public.orders AS o
WHERE
  (ce.recipient_email IS NULL OR BTRIM(ce.recipient_email) = '')
  AND ce.order_id = o.id
  AND o.customer_email IS NOT NULL
  AND ce.status IN ('queued', 'processing');

-- 3) Cleanup: mark any remaining invalid queued/processing events as failed with a clear reason
UPDATE public.communication_events AS ce
SET
  status = 'failed',
  error_message = CONCAT_WS(
    ' | ',
    NULLIF(COALESCE(ce.error_message, ''), ''),
    'Missing or invalid recipient_email (auto-cleanup)'
  ),
  updated_at = NOW()
WHERE
  ce.status IN ('queued', 'processing')
  AND (
    ce.recipient_email IS NULL
    OR BTRIM(ce.recipient_email) = ''
    OR NOT (LOWER(ce.recipient_email) ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$')
  );
