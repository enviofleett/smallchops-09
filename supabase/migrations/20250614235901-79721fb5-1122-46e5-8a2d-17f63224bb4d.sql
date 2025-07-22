
-- Check current RLS policies for categories table and update them
-- First, let's see if RLS is enabled and create proper policies

-- Ensure RLS is enabled (this is safe to run even if already enabled)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.categories;

-- Create comprehensive policies for categories
-- Policy for viewing categories (all authenticated users can view)
CREATE POLICY "Anyone can view categories"
ON public.categories FOR SELECT
USING (true);

-- Policy for inserting categories (authenticated users can create)
CREATE POLICY "Authenticated users can create categories"
ON public.categories FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Policy for updating categories (authenticated users can update)
CREATE POLICY "Authenticated users can update categories"
ON public.categories FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Policy for deleting categories (authenticated users can delete)
CREATE POLICY "Authenticated users can delete categories"
ON public.categories FOR DELETE
USING (auth.role() = 'authenticated');
