-- Add foreign key constraint for order_delivery_schedule
ALTER TABLE public.order_delivery_schedule 
ADD CONSTRAINT fk_order_delivery_schedule_order_id 
FOREIGN KEY (order_id) REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_order_delivery_schedule_order_id 
ON public.order_delivery_schedule(order_id);

CREATE INDEX IF NOT EXISTS idx_order_delivery_schedule_delivery_date 
ON public.order_delivery_schedule(delivery_date);

-- Add metadata columns for business context caching
ALTER TABLE public.order_delivery_schedule 
ADD COLUMN IF NOT EXISTS business_context jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS validation_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS last_validated_at timestamp with time zone DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.order_delivery_schedule.business_context IS 'Cached business context including holiday info, business hours validation, etc.';
COMMENT ON COLUMN public.order_delivery_schedule.validation_status IS 'Current validation status: pending, valid, invalid, needs_review';
COMMENT ON COLUMN public.order_delivery_schedule.last_validated_at IS 'Timestamp of last schedule validation check';