-- Phase 1: Database Schema Fixes

-- First, fix the menu_section enum to include all valid sections
DO $$ 
BEGIN
    -- Add missing enum values to menu_section if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'delivery' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'menu_section')) THEN
        ALTER TYPE menu_section ADD VALUE 'delivery';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'payment' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'menu_section')) THEN
        ALTER TYPE menu_section ADD VALUE 'payment';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'reports' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'menu_section')) THEN
        ALTER TYPE menu_section ADD VALUE 'reports';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'settings' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'menu_section')) THEN
        ALTER TYPE menu_section ADD VALUE 'settings';
    END IF;
END $$;

-- Insert comprehensive menu structure for all system features
INSERT INTO public.menu_structure (key, label, parent_key, sort_order, is_active, permission_levels) VALUES
-- Main sections
('dashboard', 'Dashboard', NULL, 1, true, '["none", "view", "edit"]'),
('products', 'Products', NULL, 2, true, '["none", "view", "edit"]'),
('categories', 'Categories', NULL, 3, true, '["none", "view", "edit"]'),
('orders', 'Orders', NULL, 4, true, '["none", "view", "edit"]'),
('customers', 'Customers', NULL, 5, true, '["none", "view", "edit"]'),
('delivery', 'Delivery', NULL, 6, true, '["none", "view", "edit"]'),
('payment', 'Payment', NULL, 7, true, '["none", "view", "edit"]'),
('reports', 'Reports', NULL, 8, true, '["none", "view", "edit"]'),
('settings', 'Settings', NULL, 9, true, '["none", "view", "edit"]'),

-- Products sub-items
('products-list', 'Product List', 'products', 1, true, '["none", "view", "edit"]'),
('products-create', 'Create Product', 'products', 2, true, '["none", "view", "edit"]'),
('products-bulk', 'Bulk Operations', 'products', 3, true, '["none", "view", "edit"]'),

-- Orders sub-items
('orders-list', 'Order List', 'orders', 1, true, '["none", "view", "edit"]'),
('orders-create', 'Create Order', 'orders', 2, true, '["none", "view", "edit"]'),
('orders-tracking', 'Order Tracking', 'orders', 3, true, '["none", "view", "edit"]'),

-- Customers sub-items
('customers-list', 'Customer List', 'customers', 1, true, '["none", "view", "edit"]'),
('customers-analytics', 'Customer Analytics', 'customers', 2, true, '["none", "view", "edit"]'),
('customers-favorites', 'Customer Favorites', 'customers', 3, true, '["none", "view", "edit"]'),

-- Delivery sub-items
('delivery-zones', 'Delivery Zones', 'delivery', 1, true, '["none", "view", "edit"]'),
('delivery-fees', 'Delivery Fees', 'delivery', 2, true, '["none", "view", "edit"]'),
('delivery-tracking', 'Delivery Tracking', 'delivery', 3, true, '["none", "view", "edit"]'),

-- Payment sub-items
('payment-settings', 'Payment Settings', 'payment', 1, true, '["none", "view", "edit"]'),
('payment-transactions', 'Transactions', 'payment', 2, true, '["none", "view", "edit"]'),
('payment-analytics', 'Payment Analytics', 'payment', 3, true, '["none", "view", "edit"]'),
('payment-refunds', 'Refunds', 'payment', 4, true, '["none", "view", "edit"]'),
('payment-disputes', 'Disputes', 'payment', 5, true, '["none", "view", "edit"]'),

-- Reports sub-items
('reports-sales', 'Sales Reports', 'reports', 1, true, '["none", "view", "edit"]'),
('reports-customers', 'Customer Reports', 'reports', 2, true, '["none", "view", "edit"]'),
('reports-inventory', 'Inventory Reports', 'reports', 3, true, '["none", "view", "edit"]'),

-- Settings sub-items
('settings-business', 'Business Settings', 'settings', 1, true, '["none", "view", "edit"]'),
('settings-users', 'User Management', 'settings', 2, true, '["none", "view", "edit"]'),
('settings-communications', 'Communications', 'settings', 3, true, '["none", "view", "edit"]'),
('settings-audit', 'Audit Logs', 'settings', 4, true, '["none", "view", "edit"]')

ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    parent_key = EXCLUDED.parent_key,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    permission_levels = EXCLUDED.permission_levels,
    updated_at = NOW();

-- Create admin action logging function
CREATE OR REPLACE FUNCTION public.log_admin_management_action(
    action_type text,
    target_user_id uuid DEFAULT NULL,
    target_email text DEFAULT NULL,
    action_data jsonb DEFAULT NULL,
    action_result text DEFAULT 'success'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO public.audit_logs (
        user_id,
        action,
        category,
        entity_type,
        entity_id,
        message,
        new_values
    ) VALUES (
        auth.uid(),
        action_type,
        'Admin Management',
        'admin_action',
        target_user_id,
        CASE 
            WHEN action_type = 'create_admin' THEN 'Created admin invitation for ' || COALESCE(target_email, 'unknown')
            WHEN action_type = 'update_permissions' THEN 'Updated permissions for user ' || COALESCE(target_user_id::text, 'unknown')
            WHEN action_type = 'delete_user' THEN 'Deactivated user ' || COALESCE(target_user_id::text, 'unknown')
            WHEN action_type = 'delete_invitation' THEN 'Deleted invitation ' || COALESCE(target_user_id::text, 'unknown')
            ELSE action_type || ' performed'
        END,
        jsonb_build_object(
            'action_data', action_data,
            'result', action_result,
            'timestamp', NOW()
        )
    );
END;
$$;

-- Create comprehensive admin permissions validation function
CREATE OR REPLACE FUNCTION public.validate_admin_permission(
    required_permission text DEFAULT 'admin'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    user_role text;
BEGIN
    -- Get user role
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    -- Admin users have all permissions
    IF user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- For specific permission checks, check user_permissions table
    IF required_permission != 'admin' THEN
        RETURN EXISTS (
            SELECT 1 
            FROM public.user_permissions 
            WHERE user_id = auth.uid() 
            AND menu_key = required_permission 
            AND permission_level IN ('view', 'edit')
        );
    END IF;
    
    RETURN false;
END;
$$;