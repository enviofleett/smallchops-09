-- Check delivery_zones table structure and fix any issues
DO $$
BEGIN
  -- Check if delivery_zones table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_zones') THEN
    -- Create delivery_zones table if it doesn't exist
    CREATE TABLE public.delivery_zones (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      base_fee NUMERIC DEFAULT 0,
      fee_per_km NUMERIC DEFAULT 0,
      min_order_for_free_delivery NUMERIC DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      coordinates JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    
    -- Enable RLS
    ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
    CREATE POLICY "Public can view active delivery zones" 
    ON public.delivery_zones 
    FOR SELECT 
    USING (is_active = true);
    
    CREATE POLICY "Admins can manage delivery zones" 
    ON public.delivery_zones 
    FOR ALL 
    USING (is_admin())
    WITH CHECK (is_admin());
    
    RAISE NOTICE 'Created delivery_zones table';
  ELSE
    -- Add description column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'delivery_zones' AND column_name = 'description') THEN
      ALTER TABLE public.delivery_zones ADD COLUMN description TEXT;
      RAISE NOTICE 'Added description column to delivery_zones table';
    END IF;
  END IF;
END $$;