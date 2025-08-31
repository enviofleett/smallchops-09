
-- 1) Ensure no invalid references remain (safe; currently 0 rows will match)
UPDATE public.orders o
SET assigned_rider_id = NULL
WHERE assigned_rider_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.drivers d WHERE d.id = o.assigned_rider_id
  );

-- 2) Drop both existing FKs on orders.assigned_rider_id
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_assigned_rider_profile_fkey;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_assigned_rider_id_fkey;

-- 3) Add the single correct FK to drivers.id with ON DELETE SET NULL
ALTER TABLE public.orders
  ADD CONSTRAINT orders_assigned_rider_id_fkey
  FOREIGN KEY (assigned_rider_id)
  REFERENCES public.drivers(id)
  ON DELETE SET NULL;

-- 4) Add helpful index for performance
CREATE INDEX IF NOT EXISTS idx_orders_assigned_rider_id
  ON public.orders(assigned_rider_id);

-- 5) Document the intent
COMMENT ON CONSTRAINT orders_assigned_rider_id_fkey ON public.orders IS
  'assigned_rider_id references drivers.id (active riders); removing ambiguity with profiles.';
