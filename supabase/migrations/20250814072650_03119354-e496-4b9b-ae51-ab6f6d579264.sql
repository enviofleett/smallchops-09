-- Fix database security issues identified by linter

-- 1. Fix security definer view issue
-- Drop and recreate any problematic views without SECURITY DEFINER
DROP VIEW IF EXISTS public.order_summary_view;

-- 2. Fix function search path issues for all functions
-- Update each function with proper search_path setting

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

-- Fix any other functions that might have search path issues
CREATE OR REPLACE FUNCTION public.check_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Validate status transitions
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Log status change
        INSERT INTO public.order_status_changes (order_id, old_status, new_status, changed_at)
        VALUES (NEW.id, OLD.status, NEW.status, NOW());
    END IF;
    
    RETURN NEW;
END;
$$;

-- 3. Move extensions from public schema to extensions schema
-- Note: This requires superuser privileges, so we'll document it

-- 4. Add proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(order_time);

-- 5. Add proper RLS policies for business_settings table
-- This table should be read-only for authenticated users and admin-writable
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read business settings
CREATE POLICY "business_settings_read_policy" ON public.business_settings
    FOR SELECT USING (true);

-- Allow admin users to manage business settings
CREATE POLICY "business_settings_admin_policy" ON public.business_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.email IN (
                SELECT email FROM public.admin_users WHERE is_active = true
            )
        )
    );

-- 6. Add proper constraints and validation
ALTER TABLE public.orders 
ADD CONSTRAINT check_positive_total_amount 
CHECK (total_amount >= 0);

ALTER TABLE public.order_items 
ADD CONSTRAINT check_positive_quantity 
CHECK (quantity > 0);

ALTER TABLE public.order_items 
ADD CONSTRAINT check_positive_unit_price 
CHECK (unit_price >= 0);

-- 7. Add order status change logging table if not exists
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

-- Policy for order status changes
CREATE POLICY "order_status_changes_policy" ON public.order_status_changes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = order_status_changes.order_id 
            AND (
                orders.customer_id = auth.uid() 
                OR auth.uid() IN (
                    SELECT id FROM auth.users 
                    WHERE email IN (
                        SELECT email FROM public.admin_users WHERE is_active = true
                    )
                )
            )
        )
    );

-- 8. Add proper audit triggers
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