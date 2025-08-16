
  -- PHASE 0: Utility trigger to update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_timestamp'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $fn$
    BEGIN
      NEW.updated_at := NOW();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

-- =========================================================
-- P0: STOP THE PRODUCTION ERROR - delivery_analytics
-- =========================================================
CREATE TABLE IF NOT EXISTS public.delivery_analytics (
  date date PRIMARY KEY,
  total_deliveries integer NOT NULL DEFAULT 0,
  completed_deliveries integer NOT NULL DEFAULT 0,
  failed_deliveries integer NOT NULL DEFAULT 0,
  total_delivery_fees numeric NOT NULL DEFAULT 0,
  average_delivery_time_minutes numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.delivery_analytics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Admins can manage
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage delivery_analytics'
  ) THEN
    CREATE POLICY "Admins can manage delivery_analytics"
      ON public.delivery_analytics
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;

  -- Service role can manage (for ETL/processors)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage delivery_analytics'
  ) THEN
    CREATE POLICY "Service role can manage delivery_analytics"
      ON public.delivery_analytics
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- =========================================================
-- P0: payment analytics dependencies
-- =========================================================

-- 1) payment_transactions (used by multiple edge functions and admin views)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  provider_reference text UNIQUE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'pending',
  fees numeric,
  channel text,
  customer_email text,
  provider_response jsonb,
  paid_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Refresh updated_at on changes
DROP TRIGGER IF EXISTS trg_payment_transactions_updated_at ON public.payment_transactions;
CREATE TRIGGER trg_payment_transactions_updated_at
BEFORE UPDATE ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON public.payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer_email ON public.payment_transactions(LOWER(customer_email));

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view payment_transactions'
  ) THEN
    CREATE POLICY "Admins can view payment_transactions"
      ON public.payment_transactions
      FOR SELECT
      USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage payment_transactions'
  ) THEN
    CREATE POLICY "Service role can manage payment_transactions"
      ON public.payment_transactions
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- 2) transaction_analytics (used by payment-analytics edge function)
CREATE TABLE IF NOT EXISTS public.transaction_analytics (
  date date PRIMARY KEY,
  total_transactions integer NOT NULL DEFAULT 0,
  successful_transactions integer NOT NULL DEFAULT 0,
  failed_transactions integer NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  total_fees numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_analytics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view transaction_analytics'
  ) THEN
    CREATE POLICY "Admins can view transaction_analytics"
      ON public.transaction_analytics
      FOR SELECT
      USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage transaction_analytics'
  ) THEN
    CREATE POLICY "Service role can manage transaction_analytics"
      ON public.transaction_analytics
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- =========================================================
-- P1: Routing & Scheduling
-- =========================================================

-- route_order_assignments
CREATE TABLE IF NOT EXISTS public.route_order_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.delivery_routes(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  estimated_arrival timestamptz,
  actual_arrival timestamptz,
  delivery_status text NOT NULL CHECK (delivery_status IN ('pending','en_route','delivered','failed')),
  delivery_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roa_route_id ON public.route_order_assignments(route_id);
CREATE INDEX IF NOT EXISTS idx_roa_order_id ON public.route_order_assignments(order_id);

ALTER TABLE public.route_order_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Admin manage
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage route_order_assignments'
  ) THEN
    CREATE POLICY "Admins manage route_order_assignments"
      ON public.route_order_assignments
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;

  -- Drivers can view their routes' assignments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can view assignments for their routes'
  ) THEN
    CREATE POLICY "Drivers can view assignments for their routes"
      ON public.route_order_assignments
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.delivery_routes dr
          JOIN public.drivers d ON d.id = dr.driver_id
          WHERE dr.id = route_id AND d.profile_id = auth.uid()
        )
      );
  END IF;

  -- Service role manage
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role manage route_order_assignments'
  ) THEN
    CREATE POLICY "Service role manage route_order_assignments"
      ON public.route_order_assignments
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- order_delivery_schedule
CREATE TABLE IF NOT EXISTS public.order_delivery_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  delivery_date date NOT NULL,
  delivery_time_start time NOT NULL,
  delivery_time_end time NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  is_flexible boolean NOT NULL DEFAULT false,
  special_instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_order_delivery_schedule_updated_at ON public.order_delivery_schedule;
CREATE TRIGGER trg_order_delivery_schedule_updated_at
BEFORE UPDATE ON public.order_delivery_schedule
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE INDEX IF NOT EXISTS idx_ods_order_id ON public.order_delivery_schedule(order_id);
CREATE INDEX IF NOT EXISTS idx_ods_delivery_date ON public.order_delivery_schedule(delivery_date);

ALTER TABLE public.order_delivery_schedule ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Admin manage
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage order_delivery_schedule'
  ) THEN
    CREATE POLICY "Admins manage order_delivery_schedule"
      ON public.order_delivery_schedule
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;

  -- Customers can view & manage their own order schedules
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Customers can view their own order schedules'
  ) THEN
    CREATE POLICY "Customers can view their own order schedules"
      ON public.order_delivery_schedule
      FOR SELECT
      USING (
        order_id IN (
          SELECT o.id
          FROM public.orders o
          WHERE (
            (o.customer_id IS NOT NULL AND o.customer_id IN (
              SELECT ca.id FROM public.customer_accounts ca WHERE ca.user_id = auth.uid()
            ))
            OR
            (o.customer_email IS NOT NULL AND lower(o.customer_email) = current_user_email())
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Customers can insert/update their own order schedules'
  ) THEN
    CREATE POLICY "Customers can insert/update their own order schedules"
      ON public.order_delivery_schedule
      FOR INSERT WITH CHECK (
        order_id IN (
          SELECT o.id
          FROM public.orders o
          WHERE (
            (o.customer_id IS NOT NULL AND o.customer_id IN (
              SELECT ca.id FROM public.customer_accounts ca WHERE ca.user_id = auth.uid()
            ))
            OR
            (o.customer_email IS NOT NULL AND lower(o.customer_email) = current_user_email())
          )
        )
      );

    CREATE POLICY "Customers can update their own order schedules"
      ON public.order_delivery_schedule
      FOR UPDATE USING (
        order_id IN (
          SELECT o.id
          FROM public.orders o
          WHERE (
            (o.customer_id IS NOT NULL AND o.customer_id IN (
              SELECT ca.id FROM public.customer_accounts ca WHERE ca.user_id = auth.uid()
            ))
            OR
            (o.customer_email IS NOT NULL AND lower(o.customer_email) = current_user_email())
          )
        )
      )
      WITH CHECK (
        order_id IN (
          SELECT o.id
          FROM public.orders o
          WHERE (
            (o.customer_id IS NOT NULL AND o.customer_id IN (
              SELECT ca.id FROM public.customer_accounts ca WHERE ca.user_id = auth.uid()
            ))
            OR
            (o.customer_email IS NOT NULL AND lower(o.customer_email) = current_user_email())
          )
        )
      );
  END IF;

  -- Service role manage
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role manage order_delivery_schedule'
  ) THEN
    CREATE POLICY "Service role manage order_delivery_schedule"
      ON public.order_delivery_schedule
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- =========================================================
-- P1: Communication Events (payment confirmation trigger depends on this)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.communication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  recipient_email text,
  template_key text,
  email_type text,
  status text NOT NULL DEFAULT 'queued',
  variables jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Admins can view
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view communication_events'
  ) THEN
    CREATE POLICY "Admins can view communication_events"
      ON public.communication_events
      FOR SELECT
      USING (is_admin());
  END IF;

  -- Service role manage (edge functions send/queue events)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role manage communication_events'
  ) THEN
    CREATE POLICY "Service role manage communication_events"
      ON public.communication_events
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- =========================================================
-- P1: Delivery Zones + Fees (UI + analytics)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  polygon jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
  base_fee numeric NOT NULL DEFAULT 0,
  fee_per_km numeric NOT NULL DEFAULT 0,
  min_order_for_free_delivery numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_fees_zone_id ON public.delivery_fees(zone_id);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_fees ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Public can view active zones (needed in checkout)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can view active delivery_zones'
  ) THEN
    CREATE POLICY "Public can view active delivery_zones"
      ON public.delivery_zones
      FOR SELECT
      USING (is_active = true);
  END IF;

  -- Admins manage zones/fees
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage delivery_zones'
  ) THEN
    CREATE POLICY "Admins manage delivery_zones"
      ON public.delivery_zones
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage delivery_fees'
  ) THEN
    CREATE POLICY "Admins manage delivery_fees"
      ON public.delivery_fees
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;

  -- Public can view fees (read-only)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can view delivery_fees'
  ) THEN
    CREATE POLICY "Public can view delivery_fees"
      ON public.delivery_fees
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- =========================================================
-- P1: Drivers (referenced by routes and RLS)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE,
  name text NOT NULL,
  phone text,
  vehicle_type text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Admin manage
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage drivers'
  ) THEN
    CREATE POLICY "Admins manage drivers"
      ON public.drivers
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;

  -- Drivers can view their own driver record
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can view their own record'
  ) THEN
    CREATE POLICY "Drivers can view their own record"
      ON public.drivers
      FOR SELECT
      USING (profile_id = auth.uid());
  END IF;

  -- Service role manage
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role manage drivers'
  ) THEN
    CREATE POLICY "Service role manage drivers"
      ON public.drivers
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- =========================================================
-- VALIDATION QUERIES (read-only)
-- =========================================================

-- Validate critical tables exist
SELECT 'delivery_analytics' AS table, EXISTS (
  SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_analytics'
) AS exists;

SELECT 'transaction_analytics' AS table, EXISTS (
  SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='transaction_analytics'
) AS exists;

SELECT 'payment_transactions' AS table, EXISTS (
  SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='payment_transactions'
) AS exists;

SELECT 'route_order_assignments' AS table, EXISTS (
  SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='route_order_assignments'
) AS exists;

SELECT 'order_delivery_schedule' AS table, EXISTS (
  SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='order_delivery_schedule'
) AS exists;

SELECT 'communication_events' AS table, EXISTS (
  SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='communication_events'
) AS exists;

SELECT 'delivery_zones' AS table, EXISTS (
  SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_zones'
) AS exists;

SELECT 'delivery_fees' AS table, EXISTS (
  SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='delivery_fees'
) AS exists;

SELECT 'drivers' AS table, EXISTS (
  SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='drivers'
) AS exists;

-- Validate critical columns on delivery_analytics
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='delivery_analytics'
ORDER BY ordinal_position;

-- Validate critical columns on payment_transactions
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='payment_transactions'
ORDER BY ordinal_position;

-- Validate critical columns on route_order_assignments
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='route_order_assignments'
ORDER BY ordinal_position;

-- Validate critical columns on order_delivery_schedule
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='order_delivery_schedule'
ORDER BY ordinal_position;

-- Validate critical columns on communication_events
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='communication_events'
ORDER BY ordinal_position;

-- Validate critical columns on delivery_zones
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='delivery_zones'
ORDER BY ordinal_position;

-- Validate critical columns on delivery_fees
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='delivery_fees'
ORDER BY ordinal_position;

-- Validate critical columns on drivers
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='drivers'
ORDER BY ordinal_position;

  