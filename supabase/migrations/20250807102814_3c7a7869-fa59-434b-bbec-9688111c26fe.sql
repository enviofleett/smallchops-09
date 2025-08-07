-- Create the default pickup point to match the hardcoded UUID in frontend
INSERT INTO pickup_points (
  id,
  name, 
  address,
  contact_phone,
  operating_hours,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Main Store',
  '2B Close Off 11Crescent Kado Estate, Kado',
  '0807 301 1100',
  '{
    "monday": {"open": "09:00", "close": "18:00"},
    "tuesday": {"open": "09:00", "close": "18:00"},
    "wednesday": {"open": "09:00", "close": "18:00"}, 
    "thursday": {"open": "09:00", "close": "18:00"},
    "friday": {"open": "09:00", "close": "18:00"},
    "saturday": {"open": "09:00", "close": "18:00"},
    "sunday": {"open": "09:00", "close": "18:00"}
  }'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  contact_phone = EXCLUDED.contact_phone,
  operating_hours = EXCLUDED.operating_hours,
  is_active = EXCLUDED.is_active;