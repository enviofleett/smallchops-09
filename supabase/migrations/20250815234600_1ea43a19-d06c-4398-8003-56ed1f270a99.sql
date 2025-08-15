-- Enable RLS on business_settings if not already enabled
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admin can view business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Admin can update business settings" ON public.business_settings;

-- Create policies for business_settings
CREATE POLICY "Admin can view business settings" 
ON public.business_settings 
FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Admin can update business settings" 
ON public.business_settings 
FOR UPDATE 
USING (public.is_admin());

-- Enable RLS on menu_structure if not already enabled
ALTER TABLE public.menu_structure ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admin can view menu structure" ON public.menu_structure;
DROP POLICY IF EXISTS "Admin can update menu structure" ON public.menu_structure;

-- Create policies for menu_structure
CREATE POLICY "Admin can view menu structure" 
ON public.menu_structure 
FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Admin can update menu structure" 
ON public.menu_structure 
FOR UPDATE 
USING (public.is_admin());