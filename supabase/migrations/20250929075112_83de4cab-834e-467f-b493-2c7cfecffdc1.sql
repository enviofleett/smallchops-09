-- Create admin profile for toolbuxdev@gmail.com with proper UUID
INSERT INTO profiles (id, email, role, status, is_active, name)
VALUES (
  'b29ca05f-71b3-4159-a7e9-f33f45488285'::uuid,
  'toolbuxdev@gmail.com',
  'admin'::user_role,
  'active'::user_status,
  true,
  'Admin User - ToolBux'
) ON CONFLICT (id) DO UPDATE SET
  email = 'toolbuxdev@gmail.com',
  role = 'admin'::user_role,
  status = 'active'::user_status,
  is_active = true,
  name = 'Admin User - ToolBux';

-- Ensure admin has user creation permissions
INSERT INTO user_permissions (id, user_id, menu_key, permission_level)
VALUES (
  gen_random_uuid(),
  'b29ca05f-71b3-4159-a7e9-f33f45488285'::uuid,
  'settings_admin_users',
  'edit'::permission_level
) ON CONFLICT (user_id, menu_key) DO UPDATE SET
  permission_level = 'edit'::permission_level;

-- Add all admin permissions for toolbuxdev@gmail.com
INSERT INTO user_permissions (id, user_id, menu_key, permission_level)
SELECT 
  gen_random_uuid(),
  'b29ca05f-71b3-4159-a7e9-f33f45488285'::uuid,
  menu_key,
  'edit'::permission_level
FROM (
  VALUES 
    ('settings_business'),
    ('settings_payments'),
    ('settings_delivery'),
    ('settings_communications'),
    ('orders_management'),
    ('products_management'),
    ('customers_management'),
    ('analytics_dashboard'),
    ('content_management'),
    ('drivers_management'),
    ('delivery_zones')
) AS admin_menus(menu_key)
ON CONFLICT (user_id, menu_key) DO UPDATE SET
  permission_level = 'edit'::permission_level;