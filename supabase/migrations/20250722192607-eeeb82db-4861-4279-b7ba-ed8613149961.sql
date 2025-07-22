
-- Create menu_structure table to define available menus and sub-menus dynamically
CREATE TABLE IF NOT EXISTS public.menu_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  parent_key TEXT REFERENCES public.menu_structure(key) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  permission_levels JSONB DEFAULT '["none", "view", "edit"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add sub_menu_section to user_permissions table
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS sub_menu_section TEXT,
ADD COLUMN IF NOT EXISTS menu_key TEXT;

-- Enable RLS on menu_structure
ALTER TABLE public.menu_structure ENABLE ROW LEVEL SECURITY;

-- Create policy for menu_structure
CREATE POLICY "Admins can manage menu structure"
ON public.menu_structure FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Create policy for viewing menu structure
CREATE POLICY "Users can view active menu structure"
ON public.menu_structure FOR SELECT
USING (is_active = true);

-- Create trigger for updated_at on menu_structure
CREATE TRIGGER handle_updated_at_menu_structure
BEFORE UPDATE ON public.menu_structure
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- Insert default menu structure
INSERT INTO public.menu_structure (key, label, parent_key, sort_order) VALUES
('dashboard', 'Dashboard', NULL, 1),
('orders', 'Orders', NULL, 2),
('orders_view', 'View Orders', 'orders', 1),
('orders_create', 'Create Orders', 'orders', 2),
('orders_manage', 'Manage Orders', 'orders', 3),
('categories', 'Categories', NULL, 3),
('categories_view', 'View Categories', 'categories', 1),
('categories_manage', 'Manage Categories', 'categories', 2),
('products', 'Products', NULL, 4),
('products_view', 'View Products', 'products', 1),
('products_manage', 'Manage Products', 'products', 2),
('products_inventory', 'Inventory Management', 'products', 3),
('customers', 'Customers', NULL, 5),
('customers_view', 'View Customers', 'customers', 1),
('customers_manage', 'Manage Customers', 'customers', 2),
('delivery_pickup', 'Delivery & Pickup', NULL, 6),
('delivery_zones', 'Delivery Zones', 'delivery_pickup', 1),
('delivery_fees', 'Delivery Fees', 'delivery_pickup', 2),
('promotions', 'Promotions', NULL, 7),
('promotions_view', 'View Promotions', 'promotions', 1),
('promotions_manage', 'Manage Promotions', 'promotions', 2),
('reports', 'Reports', NULL, 8),
('reports_sales', 'Sales Reports', 'reports', 1),
('reports_analytics', 'Analytics', 'reports', 2),
('settings', 'Settings', NULL, 9),
('settings_business', 'Business Settings', 'settings', 1),
('settings_users', 'User Management', 'settings', 2),
('settings_system', 'System Settings', 'settings', 3),
('audit_logs', 'Audit Logs', NULL, 10);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_menu_structure_parent_key ON public.menu_structure(parent_key);
CREATE INDEX IF NOT EXISTS idx_menu_structure_is_active ON public.menu_structure(is_active);
CREATE INDEX IF NOT EXISTS idx_user_permissions_menu_key ON public.user_permissions(menu_key);
