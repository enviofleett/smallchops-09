-- Fix invalid delivery zone references by assigning them to the first available zone
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

-- Add foreign key constraint (now safe since we fixed invalid references)
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