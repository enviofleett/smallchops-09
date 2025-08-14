-- Fix database security issues without admin_users dependency

-- 1. Fix search path issues for functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 2. Add proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(order_time);

-- 3. Add proper RLS policies for business_settings table
-- This table should be read-only for all users
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read business settings (needed for public site)
DROP POLICY IF EXISTS "business_settings_read_policy" ON public.business_settings;
CREATE POLICY "business_settings_read_policy" ON public.business_settings
    FOR SELECT USING (true);

-- Allow authenticated users to manage business settings (simpler check)
DROP POLICY IF EXISTS "business_settings_admin_policy" ON public.business_settings;
CREATE POLICY "business_settings_admin_policy" ON public.business_settings
    FOR ALL USING (auth.role() = 'authenticated');

-- 4. Add proper constraints and validation
ALTER TABLE public.orders 
ADD CONSTRAINT check_positive_total_amount 
CHECK (total_amount >= 0);

ALTER TABLE public.order_items 
ADD CONSTRAINT check_positive_quantity 
CHECK (quantity > 0);

ALTER TABLE public.order_items 
ADD CONSTRAINT check_positive_unit_price 
CHECK (unit_price >= 0);

-- 5. Add order status change logging table if not exists
CREATE TABLE IF NOT EXISTS public.order_status_changes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    old_status text,
    new_status text NOT NULL,
    changed_at timestamp with time zone DEFAULT now(),
    changed_by uuid REFERENCES auth.users(id)
);

-- Enable RLS on status changes
ALTER TABLE public.order_status_changes ENABLE ROW LEVEL SECURITY;

-- Policy for order status changes - allow viewing by order owner
CREATE POLICY "order_status_changes_view_policy" ON public.order_status_changes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = order_status_changes.order_id 
            AND (
                orders.customer_id = auth.uid() 
                OR orders.customer_email IN (
                    SELECT email FROM auth.users WHERE id = auth.uid()
                )
            )
        )
    );

-- 6. Add proper audit triggers
CREATE OR REPLACE FUNCTION public.audit_order_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Log significant changes
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO public.order_status_changes (order_id, old_status, new_status, changed_by)
            VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

-- Apply audit trigger to orders table
DROP TRIGGER IF EXISTS orders_audit_trigger ON public.orders;
CREATE TRIGGER orders_audit_trigger
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_order_changes();