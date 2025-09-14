-- Insert discount code permissions for existing admin users
INSERT INTO user_permissions (user_id, menu_key, permission_level, menu_section)
SELECT 
  up.user_id,
  'discount_codes_view' as menu_key,
  'edit' as permission_level,
  'promotions' as menu_section
FROM user_permissions up
WHERE up.menu_key = 'settings_admin_users' 
  AND up.permission_level = 'edit'
  AND NOT EXISTS (
    SELECT 1 FROM user_permissions 
    WHERE user_id = up.user_id 
    AND menu_key = 'discount_codes_view'
  );