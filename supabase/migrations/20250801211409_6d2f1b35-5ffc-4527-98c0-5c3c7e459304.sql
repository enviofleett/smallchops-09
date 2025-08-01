-- Update the public-api edge function to include delivery zones endpoint

-- Since the delivery_zone_id column already exists in orders table, we just need to ensure
-- the RLS policies are correct for public access to delivery zones and fees

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Public can view delivery zones for checkout" ON public.delivery_zones;
DROP POLICY IF EXISTS "Public can view delivery fees for checkout" ON public.delivery_fees;

-- Create new policies for public access to delivery zones
CREATE POLICY "Public can view delivery zones for checkout" 
ON public.delivery_zones 
FOR SELECT 
USING (true);

-- Create new policies for public access to delivery fees  
CREATE POLICY "Public can view delivery fees for checkout"
ON public.delivery_fees
FOR SELECT
USING (true);