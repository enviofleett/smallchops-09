-- First check if delivery_zones table exists and what columns it has
DO $$
BEGIN
    -- Drop and recreate delivery_zones table to ensure consistent schema
    DROP TABLE IF EXISTS delivery_zones CASCADE;
    
    -- Create delivery zones table with correct schema
    CREATE TABLE delivery_zones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        base_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
    );

    -- Enable RLS
    ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

    -- Insert default delivery zones
    INSERT INTO delivery_zones (name, base_fee) VALUES 
        ('Lagos Island', 1500),
        ('Lagos Mainland', 2000),
        ('Ikeja', 2500),
        ('Victoria Island', 1500),
        ('Lekki', 3000),
        ('Default', 2000);

END $$;

-- Ensure delivery-related columns exist in orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_date TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_ready BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMP;

-- Create deliveries table if it doesn't exist
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    delivery_address TEXT NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'scheduled',
    estimated_delivery TIMESTAMP,
    actual_delivery TIMESTAMP,
    delivery_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS on deliveries table
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

-- Create RLS policies for deliveries
DROP POLICY IF EXISTS "Customers can view their own deliveries" ON deliveries;
CREATE POLICY "Customers can view their own deliveries" ON deliveries
FOR SELECT USING (
  order_id IN (
    SELECT id FROM orders 
    WHERE customer_id IN (
      SELECT id FROM customer_accounts WHERE user_id = auth.uid()
    )
    OR customer_email = current_user_email()
  )
);

DROP POLICY IF EXISTS "Admins can manage all deliveries" ON deliveries;
CREATE POLICY "Admins can manage all deliveries" ON deliveries
FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Service roles can manage deliveries" ON deliveries;
CREATE POLICY "Service roles can manage deliveries" ON deliveries
FOR ALL USING (auth.role() = 'service_role');

-- Create RLS policies for delivery zones
DROP POLICY IF EXISTS "Public can view active delivery zones" ON delivery_zones;
CREATE POLICY "Public can view active delivery zones" ON delivery_zones
FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage delivery zones" ON delivery_zones;
CREATE POLICY "Admins can manage delivery zones" ON delivery_zones
FOR ALL USING (is_admin());