-- Add new columns to products table for enhanced product management
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_promotional boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS preparation_time integer,
ADD COLUMN IF NOT EXISTS allergen_info text[];

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_is_promotional ON public.products(is_promotional) WHERE is_promotional = true;
CREATE INDEX IF NOT EXISTS idx_products_features ON public.products USING GIN(features);

-- Add comments for documentation
COMMENT ON COLUMN public.products.features IS 'JSON array of product features and highlights';
COMMENT ON COLUMN public.products.is_promotional IS 'Whether this product should be featured as promotional';
COMMENT ON COLUMN public.products.preparation_time IS 'Preparation time in minutes';
COMMENT ON COLUMN public.products.allergen_info IS 'Array of allergen information';

-- Update the existing RLS policies to ensure new fields are accessible
-- The existing policies should already cover these new columns