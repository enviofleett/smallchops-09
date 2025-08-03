-- Create admin profile for current user (without email column)
INSERT INTO public.profiles (
  id, 
  name, 
  role, 
  status,
  created_at, 
  updated_at
) VALUES (
  '2c463a1e-ee26-4a9a-84e9-973e150c6724',
  'envio demo',
  'admin',
  'active',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = 'admin',
  status = 'active',
  updated_at = NOW();

-- Create default business settings if they don't exist
INSERT INTO public.business_settings (
  name,
  email,
  primary_color,
  secondary_color,
  accent_color,
  created_at,
  updated_at
) VALUES (
  'Starters Small Chops',
  'chudesyl@gmail.com',
  '#3b82f6',
  '#1e40af', 
  '#f59e0b',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;