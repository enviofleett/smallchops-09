-- Clean up duplicate menu items and ensure consistency
-- First, let's see what we have
DELETE FROM menu_structure WHERE key IN (
  'settings_business', 'settings_users', 'settings_system'
) AND parent_key = 'settings';

-- Remove any other potential duplicates by keeping only the ones with proper formatting
DELETE FROM menu_structure 
WHERE key LIKE '%_%' 
AND EXISTS (
  SELECT 1 FROM menu_structure ms2 
  WHERE ms2.key = REPLACE(menu_structure.key, '_', '-')
  AND ms2.id != menu_structure.id
);

-- Ensure we have a proper menu structure for toolbux user
-- Add toolbux as a specific menu item if it doesn't exist
INSERT INTO menu_structure (key, label, parent_key, sort_order, is_active, permission_levels) 
VALUES ('toolbux', 'ToolBux User', 'settings', 100, true, '["none", "view", "edit"]'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  parent_key = EXCLUDED.parent_key,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- Add other common user management items
INSERT INTO menu_structure (key, label, parent_key, sort_order, is_active, permission_levels) 
VALUES 
  ('users-management', 'User Management', 'settings', 90, true, '["none", "view", "edit"]'::jsonb),
  ('roles-permissions', 'Roles & Permissions', 'settings', 95, true, '["none", "view", "edit"]'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  parent_key = EXCLUDED.parent_key,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;