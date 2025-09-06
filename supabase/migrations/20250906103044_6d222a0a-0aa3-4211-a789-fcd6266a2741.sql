
-- 1) Add a tolerant 'phone' column to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS phone text;

-- 2) Backfill existing data for consistency
UPDATE public.orders
SET phone = customer_phone
WHERE phone IS NULL;

-- 3) Create a trigger function to keep phone and customer_phone in sync
CREATE OR REPLACE FUNCTION public.normalize_order_phone()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If 'phone' is provided, use it as the source of truth for 'customer_phone'
  IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    NEW.customer_phone := NEW.phone;
  END IF;

  -- Now ensure 'phone' always mirrors 'customer_phone'
  IF NEW.customer_phone IS NOT NULL THEN
    NEW.phone := NEW.customer_phone;
  ELSE
    NEW.phone := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Attach the trigger for inserts and updates
DROP TRIGGER IF EXISTS trg_normalize_order_phone ON public.orders;

CREATE TRIGGER trg_normalize_order_phone
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.normalize_order_phone();
