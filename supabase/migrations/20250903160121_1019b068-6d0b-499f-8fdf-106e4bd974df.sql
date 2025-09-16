-- Confirm email for admin user segunalaka@gmail.com
UPDATE auth.users 
SET 
  email_confirmed_at = NOW(),
  updated_at = NOW()
WHERE email = 'segunalaka@gmail.com';