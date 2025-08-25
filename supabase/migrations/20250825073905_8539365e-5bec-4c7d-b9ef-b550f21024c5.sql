
-- Hotfix: add missing 'reason' column so payment verification + status logging works
-- Safe for production: idempotent, no UI/code changes

-- 1) Ensure the reason column exists on order_status_changes
ALTER TABLE public.order_status_changes
ADD COLUMN IF NOT EXISTS reason text;

-- 2) If an archive table exists, add reason there as well (safely)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'order_status_changes_archive'
  ) THEN
    EXECUTE 'ALTER TABLE public.order_status_changes_archive ADD COLUMN IF NOT EXISTS reason text';
  END IF;
END;
$$;

-- 3) Recreate the trigger function to write 'reason'
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only log when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_changes (
      order_id,
      old_status,
      previous_status,
      new_status,
      changed_by,
      changed_at,
      reason
    ) VALUES (
      NEW.id,
      OLD.status,
      OLD.status,
      NEW.status,
      auth.uid(),
      NOW(),
      'Status updated via order modification'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Rebind the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS trigger_log_order_status_change ON public.orders;

CREATE TRIGGER trigger_log_order_status_change
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_status_change();
