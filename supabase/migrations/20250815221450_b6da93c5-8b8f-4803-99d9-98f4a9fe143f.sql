-- Add performance indexes for delivery management
CREATE INDEX IF NOT EXISTS idx_orders_paid_delivery_time ON public.orders (payment_status, order_type, order_time);
CREATE INDEX IF NOT EXISTS idx_order_schedule_order ON public.order_delivery_schedule (order_id);
CREATE INDEX IF NOT EXISTS idx_order_schedule_date_time ON public.order_delivery_schedule (delivery_date, delivery_time_start);
CREATE INDEX IF NOT EXISTS idx_orders_zone ON public.orders (delivery_zone_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_rider ON public.orders (assigned_rider_id);

-- Add delivery fee column to orders if it doesn't exist (for shipping fee reports)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) DEFAULT 0;