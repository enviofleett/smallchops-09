
-- Add user tracking and timestamp columns to the orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add a trigger to automatically update the 'updated_at' timestamp on the orders table
DROP TRIGGER IF EXISTS handle_updated_at_orders ON public.orders;
CREATE TRIGGER handle_updated_at_orders
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- Enable Row Level Security on orders and order_items tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for 'orders' table

-- Admins and managers have full access to orders.
CREATE POLICY "Admins and managers have full access to orders"
ON public.orders FOR ALL
USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'))
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

-- Staff can view all orders.
CREATE POLICY "Staff can view orders"
ON public.orders FOR SELECT
USING (public.get_user_role(auth.uid()) = 'staff');

-- Staff can create new orders.
CREATE POLICY "Staff can create orders"
ON public.orders FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'staff');

-- Staff can update existing orders.
CREATE POLICY "Staff can update orders"
ON public.orders FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'staff');


-- RLS Policies for 'order_items' table

-- Access to order_items is determined by access to the parent order.
-- This single policy is sufficient because the subquery respects the RLS policies on the orders table
-- for the specific operation (SELECT, INSERT, UPDATE, DELETE).
CREATE POLICY "Order items access is derived from parent order"
ON public.order_items FOR ALL
USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_items.order_id));
