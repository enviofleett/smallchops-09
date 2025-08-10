-- Secure order transitions: function, trigger, FK, RLS, realtime (idempotent)

-- Function: validate order updates
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
  old_status := COALESCE(OLD.status::text, '');
  new_status := COALESCE(NEW.status::text, old_status);

  IF old_status IS DISTINCT FROM new_status THEN
    IF NOT (allowed ? old_status) OR NOT ((allowed->old_status) ? new_status) THEN
      RAISE EXCEPTION 'Invalid order status transition: % -> %', old_status, new_status;
    END IF;
  END IF;

  IF new_status IN ('out_for_delivery','delivered','completed') THEN
    IF NEW.assigned_rider_id IS NULL THEN
      RAISE EXCEPTION 'A dispatch rider must be assigned before moving to %', new_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: drop if exists, then create
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

-- Ensure unique constraint on drivers.profile_id for FK reference
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

-- Ensure FK orders.assigned_rider_id -> drivers(profile_id) ON DELETE SET NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' AND column_name='assigned_rider_id'
  ) THEN
    -- drop any previous FK with our chosen name
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema='public' AND table_name='orders'
        AND constraint_type='FOREIGN KEY' AND constraint_name='orders_assigned_rider_profile_fkey'
    ) THEN
      ALTER TABLE public.orders DROP CONSTRAINT orders_assigned_rider_profile_fkey;
    END IF;

    -- add desired FK
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_assigned_rider_profile_fkey
      FOREIGN KEY (assigned_rider_id)
      REFERENCES public.drivers(profile_id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- Enable RLS and standard policies (recreate for consistency)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow order reads" ON public.orders;
CREATE POLICY "Allow order reads"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow order inserts" ON public.orders;
CREATE POLICY "Allow order inserts"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow order updates" ON public.orders;
CREATE POLICY "Allow order updates"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    status::text IN (
      'pending','confirmed','preparing','ready','out_for_delivery','delivered','completed','cancelled','refunded'
    )
  );

-- Realtime: full row image + ensure publication membership
ALTER TABLE public.orders REPLICA IDENTITY FULL;

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