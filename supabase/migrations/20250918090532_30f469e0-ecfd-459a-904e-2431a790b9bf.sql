-- Fix duplicate foreign key constraint issue between orders and order_delivery_schedule
-- This resolves the "Could not embed because more than one relationship was found" error

-- First, let's check if the duplicate constraint exists and remove it
DO $$ 
BEGIN
    -- Remove the duplicate foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_order_delivery_schedule_order_id' 
        AND table_name = 'order_delivery_schedule'
    ) THEN
        ALTER TABLE public.order_delivery_schedule 
        DROP CONSTRAINT fk_order_delivery_schedule_order_id;
        
        -- Log this action
        INSERT INTO audit_logs (action, category, message, new_values)
        VALUES (
            'database_schema_fix',
            'Production Fix',
            'Removed duplicate foreign key constraint to fix admin-orders-manager edge function',
            jsonb_build_object(
                'constraint_removed', 'fk_order_delivery_schedule_order_id',
                'reason', 'duplicate_relationship_error',
                'impact', 'fixes_500_errors_in_admin_panel'
            )
        );
    END IF;
END $$;

-- Ensure we have proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_delivery_schedule_order_id 
ON public.order_delivery_schedule(order_id);

-- Add a comment to document this fix
COMMENT ON TABLE public.order_delivery_schedule IS 
'Order delivery scheduling data. Fixed duplicate FK constraint issue 2025-09-18 for production stability.';