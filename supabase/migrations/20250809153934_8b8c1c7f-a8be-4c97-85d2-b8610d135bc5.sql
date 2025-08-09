-- SAFE RE-RUNNABLE MIGRATION: triggers, indexes, view, RLS, realtime, cron (retry without failing unschedule)
-- 1) Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2) Orders triggers
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_set_paid_at_on_status_change') THEN
    CREATE TRIGGER orders_set_paid_at_on_status_change
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_paid_at_on_status_change();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_trigger_order_emails') THEN
    CREATE TRIGGER orders_trigger_order_emails
    AFTER INSERT OR UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_order_emails();
  END IF;
END $$;

-- 3) Payment success trigger
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.process_payment_success()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF ((TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.paid_at IS DISTINCT FROM NEW.paid_at))
     AND (NEW.status IN ('success','paid') OR NEW.paid_at IS NOT NULL)
     AND (NEW.processed_at IS NULL) THEN
    PERFORM public.handle_successful_payment(
      NEW.provider_reference,
      NEW.paid_at,
      NEW.gateway_response,
      NEW.fees,
      NEW.channel,
      NEW.authorization_code,
      NEW.card_type,
      NEW.last4,
      NEW.exp_month,
      NEW.exp_year,
      NEW.bank
    );
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'payment_tx_process_success') THEN
    CREATE TRIGGER payment_tx_process_success
    AFTER INSERT OR UPDATE ON public.payment_transactions
    FOR EACH ROW
    WHEN (NEW.status IN ('success','paid') OR NEW.paid_at IS NOT NULL)
    EXECUTE FUNCTION public.process_payment_success();
  END IF;
END $$;

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_reference ON public.payment_transactions(provider_reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON public.orders(payment_reference);

-- 5) View: orders_with_payment
DROP VIEW IF EXISTS public.orders_with_payment;
CREATE VIEW public.orders_with_payment AS
SELECT 
  o.*, 
  tx.tx_id,
  tx.tx_status,
  tx.tx_paid_at,
  tx.tx_channel,
  tx.tx_provider_reference,
  (o.payment_status = 'paid' OR tx.tx_status IN ('success','paid')) AS final_paid,
  COALESCE(o.paid_at, tx.tx_paid_at) AS final_paid_at,
  tx.tx_channel AS payment_channel
FROM public.orders o
LEFT JOIN LATERAL (
  SELECT 
    t.id AS tx_id,
    t.status AS tx_status,
    t.paid_at AS tx_paid_at,
    t.channel AS tx_channel,
    t.provider_reference AS tx_provider_reference
  FROM public.payment_transactions t
  WHERE t.order_id = o.id OR (t.provider_reference IS NOT NULL AND t.provider_reference = o.payment_reference)
  ORDER BY COALESCE(t.paid_at, t.created_at) DESC NULLS LAST
  LIMIT 1
) tx ON TRUE;

-- 6) RLS policies (SELECT)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Admins can select all orders'
  ) THEN
    CREATE POLICY "Admins can select all orders" ON public.orders
    FOR SELECT USING (public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payment_transactions' AND policyname = 'Admins can select all payment tx'
  ) THEN
    CREATE POLICY "Admins can select all payment tx" ON public.payment_transactions
    FOR SELECT USING (public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Customers can select their orders'
  ) THEN
    CREATE POLICY "Customers can select their orders" ON public.orders
    FOR SELECT USING (
      customer_email IN (
        SELECT users.email FROM auth.users WHERE users.id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payment_transactions' AND policyname = 'Customers can select their payment tx'
  ) THEN
    CREATE POLICY "Customers can select their payment tx" ON public.payment_transactions
    FOR SELECT USING (
      (
        order_id IN (
          SELECT o.id FROM public.orders o 
          WHERE o.customer_email IN (
            SELECT users.email FROM auth.users WHERE users.id = auth.uid()
          )
        )
      )
      OR (
        provider_reference IN (
          SELECT o.payment_reference FROM public.orders o 
          WHERE o.customer_email IN (
            SELECT users.email FROM auth.users WHERE users.id = auth.uid()
          )
        )
      )
    );
  END IF;
END $$;

-- 7) Realtime configuration
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.payment_transactions REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_transactions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 8) Cron schedule (create if missing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-payments-every-5-mins') THEN
      PERFORM cron.schedule(
        'reconcile-payments-every-5-mins',
        '*/5 * * * *',
        $$
        select net.http_post(
          url:='https://oknnklksdiqaifhxaccs.functions.supabase.co/paystack-batch-verify',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA"}'::jsonb,
          body:='{"limit": 200, "dryRun": false}'::jsonb
        ) as request_id;
        $$
      );
    END IF;
  END IF;
END $$;
