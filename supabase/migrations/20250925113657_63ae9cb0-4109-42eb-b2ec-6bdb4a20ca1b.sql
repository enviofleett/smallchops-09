-- Add catering_bookings permission for all users with admin access
-- This will make the bookings menu item visible in the sidebar

-- First, add for users with admin permissions (settings admin access)
INSERT INTO user_permissions (user_id, menu_key, permission_level)
SELECT 
  ur.user_id,
  'catering_bookings',
  'edit'::permission_level
FROM user_permissions ur
WHERE ur.menu_key = 'settings_admin_users' 
  AND ur.permission_level = 'edit'
  AND NOT EXISTS (
    SELECT 1 FROM user_permissions up2 
    WHERE up2.user_id = ur.user_id 
    AND up2.menu_key = 'catering_bookings'
  );

-- Also add for any user who has dashboard access (basic access)  
INSERT INTO user_permissions (user_id, menu_key, permission_level)
SELECT DISTINCT
  up.user_id,
  'catering_bookings',
  'edit'::permission_level
FROM user_permissions up
WHERE up.menu_key = 'dashboard'
  AND up.permission_level IN ('view', 'edit')
  AND NOT EXISTS (
    SELECT 1 FROM user_permissions up2 
    WHERE up2.user_id = up.user_id 
    AND up2.menu_key = 'catering_bookings'
  );