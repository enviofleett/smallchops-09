-- Migration: secure order transitions, FK, RLS, realtime optimization
-- Filename suggestion: YYYYMMDDHHMM_secure_order_transitions.sql

-- 1) Validate order update function
CREATE OR REPLACE FUNCTION public.validate_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  allowed jsonb := '{
    "pending": ["confirmed","cancelled","refunded"],
    "confirmed": ["preparing","cancelled","refunded"],
    "preparing": ["ready","cancelled"],
    "ready": ["out_for_delivery","delivered"],
    "out_for_delivery": ["delivered","completed"],
    "delivered": ["completed","refunded"],
    "completed": ["refunded"]
  }';
  old_status text;
  new_status text;
BEGIN
  -- Normalize to text (handles enum types)
  old_status := COALESCE(OLD.status::text, '');
  new_status := COALESCE(NEW.status::text, old_status);

  -- Enforce allowed status transitions only when changing status
  IF old_status IS DISTINCT FROM new_status THEN
    IF NOT (allowed ? old_status) OR NOT ((allowed->old_status) ? new_status) THEN
      RAISE EXCEPTION 'Invalid order status transition: % -> %', old_status, new_status;
    END IF;
  END IF;

  -- Require assigned rider for delivery phases
  IF new_status IN ('out_for_delivery','delivered','completed') THEN
    IF NEW.assigned_rider_id IS NULL THEN
      RAISE EXCEPTION 'A dispatch rider must be assigned before moving to %', new_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Drop and recreate trigger on orders
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'trg_validate_order_update'
      AND n.nspname = 'public'
      AND c.relname = 'orders'
  ) THEN
    DROP TRIGGER trg_validate_order_update ON public.orders;
  END IF;
END$$;

CREATE TRIGGER trg_validate_order_update
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_order_update();

-- 3) Ensure FK orders.assigned_rider_id -> drivers(profile_id) ON DELETE SET NULL
-- Optional helper: ensure drivers.profile_id is unique so FK can reference it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='drivers' AND column_name='profile_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      WHERE tc.table_schema='public'
        AND tc.table_name='drivers'
        AND tc.constraint_type='UNIQUE'
        AND kcu.column_name='profile_id'
    ) THEN
      ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_profile_id_key UNIQUE (profile_id);
    END IF;
  END IF;
END$$;

-- Add/replace the FK constraint safely
DO $$
BEGIN
  -- Drop any existing FK on assigned_rider_id so we can replace with the desired one
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='orders'
      AND constraint_type='FOREIGN KEY' AND constraint_name='orders_assigned_rider_profile_fkey'
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_assigned_rider_profile_fkey;
  END IF;

  -- Attempt to create the desired FK (will succeed only if column exists and ref has unique/PK)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' AND column_name='assigned_rider_id'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_assigned_rider_profile_fkey
      FOREIGN KEY (assigned_rider_id)
      REFERENCES public.drivers(profile_id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- 4) Enable RLS and policies on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Read policy
DROP POLICY IF EXISTS "Allow order reads" ON public.orders;
CREATE POLICY "Allow order reads"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert policy
DROP POLICY IF EXISTS "Allow order inserts" ON public.orders;
CREATE POLICY "Allow order inserts"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update policy limited by allowed statuses (final validation in trigger)
DROP POLICY IF EXISTS "Allow order updates" ON public.orders;
CREATE POLICY "Allow order updates"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    NEW.status::text IN (
      'pending','confirmed','preparing','ready','out_for_delivery','delivered','completed','cancelled','refunded'
    )
  );

-- 5) Realtime optimization: ensure full row data and publication membership
-- Ensure changes capture full row image for reliable realtime payloads
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Ensure orders is in supabase_realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
  END IF;
END$$;

-- 6) Sample test statements (commented)
-- BEGIN; -- expect success
--   UPDATE public.orders SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-000000000000';
--   UPDATE public.orders SET status = 'preparing' WHERE id = '00000000-0000-0000-0000-000000000000';
--   -- requires rider
--   UPDATE public.orders SET assigned_rider_id = '11111111-1111-1111-1111-111111111111' WHERE id = '00000000-0000-0000-0000-000000000000';
--   UPDATE public.orders SET status = 'out_for_delivery' WHERE id = '00000000-0000-0000-0000-000000000000';
-- ROLLBACK;

-- BEGIN; -- expect failure examples
--   UPDATE public.orders SET status = 'ready' WHERE id = '00000000-0000-0000-0000-000000000000' AND status = 'pending';
--   -- ERROR: Invalid order status transition: pending -> ready
--   UPDATE public.orders SET status = 'out_for_delivery' WHERE id = '00000000-0000-0000-0000-000000000000';
--   -- ERROR: A dispatch rider must be assigned before moving to out_for_delivery
-- ROLLBACK;