
-- 1. Create 'customers' table to store registered customer details
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Add 'customer_id' (nullable) to 'orders' table to link orders to registered customers if present
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id uuid NULL REFERENCES public.customers(id);

-- 3. Add index for fast lookups on 'orders.customer_id'
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);

-- 4. (Optional but recommended) Add index to 'customers.email'
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);

-- 5. No RLS policies yet, as this is admin-facing and not end-user exposed.
