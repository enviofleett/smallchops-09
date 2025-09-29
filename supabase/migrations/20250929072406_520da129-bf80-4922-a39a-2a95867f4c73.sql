-- Create admin profile for the authenticated user
INSERT INTO profiles (id, email, role, status, is_active, name)
VALUES (
  '52d2bf88-5925-4ed7-b262-c02a9d16fec2'::uuid,
  'scottommey@yahoo.com',
  'admin'::user_role,
  'active'::user_status,
  true,
  'Admin User'
) ON CONFLICT (id) DO UPDATE SET
  role = 'admin'::user_role,
  status = 'active'::user_status,
  is_active = true;

-- Also create profile for toolboxdev user if they exist
INSERT INTO profiles (id, email, role, status, is_active, name)
SELECT 
  '00000000-0000-0000-0000-000000000000'::uuid,
  'toolboxdev@gmail.com',
  'admin'::user_role,
  'active'::user_status,
  true,
  'ToolBox Admin'
WHERE EXISTS (SELECT 1 FROM auth.users WHERE email = 'toolboxdev@gmail.com')
ON CONFLICT (id) DO UPDATE SET
  role = 'admin'::user_role,
  status = 'active'::user_status,
  is_active = true;

-- Clean up duplicate policies and create proper ones
DROP POLICY IF EXISTS "Admins can manage drivers" ON drivers;
DROP POLICY IF EXISTS "Admins manage drivers" ON drivers;
DROP POLICY IF EXISTS "Admins can view all drivers" ON drivers;
DROP POLICY IF EXISTS "Admins can manage all drivers" ON drivers;

-- Create single comprehensive admin policy for drivers
CREATE POLICY "Admin full access to drivers"
ON drivers FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());