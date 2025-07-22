
-- Create a helper function to automatically update 'updated_at' timestamps
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create an enum type for product status
CREATE TYPE public.product_status AS ENUM ('active', 'archived', 'draft');

-- Create the 'categories' table for organizing products
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add a trigger to automatically update 'updated_at' on the categories table
CREATE TRIGGER handle_updated_at_categories
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- Enhance the existing 'products' table with new columns for better management
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stock_quantity INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS status public.product_status NOT NULL DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add a trigger to automatically update 'updated_at' on the products table
CREATE TRIGGER handle_updated_at_products
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- Enable Row Level Security (RLS) on the categories table
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for the categories table
CREATE POLICY "Admins can manage categories"
ON public.categories FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Authenticated users can view categories"
ON public.categories FOR SELECT
USING (auth.role() = 'authenticated');

-- Enable Row Level Security (RLS) on the products table
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for the products table
CREATE POLICY "Admins can manage products"
ON public.products FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Authenticated users can view products"
ON public.products FOR SELECT
USING (auth.role() = 'authenticated');

