-- Ensure delivery_zones foreign key relationship exists and is properly indexed
-- This will fix PostgREST relationship resolution for order queries

-- Add foreign key constraint if it doesn't exist (will skip if already exists)
DO $$ 
BEGIN
    -- Check if foreign key constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_delivery_zone_id_fkey' 
        AND table_name = 'orders'
    ) THEN
        -- Add the foreign key constraint
        ALTER TABLE orders 
        ADD CONSTRAINT orders_delivery_zone_id_fkey 
        FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(id);
    END IF;
END $$;

-- Add indexes for better performance on order queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_delivery_zone_id ON orders(delivery_zone_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Enable realtime for orders table to ensure admin dashboard gets live updates
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE orders;

-- Ensure delivery_zones table is also available for realtime
ALTER TABLE delivery_zones REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE delivery_zones;