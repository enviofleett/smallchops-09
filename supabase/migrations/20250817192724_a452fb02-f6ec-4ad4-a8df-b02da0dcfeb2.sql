-- Clean up invalid delivery zone references and then add constraints
-- This will fix PostgREST relationship resolution for order queries

-- First, check and fix invalid delivery_zone_id references
UPDATE orders 
SET delivery_zone_id = NULL 
WHERE delivery_zone_id IS NOT NULL 
AND delivery_zone_id NOT IN (SELECT id FROM delivery_zones);

-- Add foreign key constraint (now safe since we cleaned invalid references)
ALTER TABLE orders 
ADD CONSTRAINT orders_delivery_zone_id_fkey 
FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(id);

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