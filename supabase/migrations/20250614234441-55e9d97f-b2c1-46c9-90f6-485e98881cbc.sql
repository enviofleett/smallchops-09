
-- Update the user's role to admin after they sign up normally
UPDATE public.profiles 
SET role = 'admin', name = 'Admin User'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'chudesyl@gmail.com'
);
