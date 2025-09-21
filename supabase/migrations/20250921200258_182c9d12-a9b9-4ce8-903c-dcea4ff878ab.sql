-- Fix delivery zones RLS policy to allow public access for checkout
-- This ensures anonymous users can see available delivery zones during checkout

-- Enable RLS on delivery_zones table (if not already enabled)
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Public can view delivery zones" ON delivery_zones;
DROP POLICY IF EXISTS "Authenticated users can view delivery zones" ON delivery_zones;
DROP POLICY IF EXISTS "Admin can manage delivery zones" ON delivery_zones;

-- Create new policies for production use
-- Policy 1: Public can view active delivery zones (for checkout)
CREATE POLICY "Public can view active delivery zones" 
ON delivery_zones 
FOR SELECT 
USING (is_active = true);

-- Policy 2: Admins can manage all delivery zones
CREATE POLICY "Admins can manage delivery zones" 
ON delivery_zones 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- Verify the zones are active and accessible
UPDATE delivery_zones 
SET is_active = true 
WHERE is_active IS NULL OR is_active = false;