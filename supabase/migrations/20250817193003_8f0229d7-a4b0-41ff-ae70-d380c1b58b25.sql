-- Fix invalid delivery zone references and add constraints properly
-- This will fix PostgREST relationship resolution for order queries

-- Update invalid delivery_zone_id references to use the first available zone for delivery orders
UPDATE orders 
SET delivery_zone_id = (SELECT id FROM delivery_zones LIMIT 1)
WHERE order_type = 'delivery' 
AND delivery_zone_id IS NOT NULL 
AND delivery_zone_id NOT IN (SELECT id FROM delivery_zones);

-- For pickup orders, set delivery_zone_id to NULL
UPDATE orders 
SET delivery_zone_id = NULL 
WHERE order_type = 'pickup' 
AND delivery_zone_id IS NOT NULL;

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_delivery_zone_id_fkey' 
        AND table_name = 'orders'
    ) THEN
        ALTER TABLE orders 
        ADD CONSTRAINT orders_delivery_zone_id_fkey 
        FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(id);
    END IF;
END $$;

-- Add indexes for better performance on order queries
CREATE INDEX IF NOT EXISTS idx_orders_delivery_zone_id ON orders(delivery_zone_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Enable realtime only if not already enabled
DO $$
BEGIN
    ALTER TABLE orders REPLICA IDENTITY FULL;
    
    -- Try to add to publication, ignore if already exists
    BEGIN
        ALTER publication supabase_realtime ADD TABLE orders;
    EXCEPTION WHEN duplicate_object THEN
        -- Table already in publication, continue
        NULL;
    END;
    
    ALTER TABLE delivery_zones REPLICA IDENTITY FULL;
    
    -- Try to add to publication, ignore if already exists
    BEGIN
        ALTER publication supabase_realtime ADD TABLE delivery_zones;
    EXCEPTION WHEN duplicate_object THEN
        -- Table already in publication, continue
        NULL;
    END;
END $$;