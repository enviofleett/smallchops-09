-- Drop existing triggers if they exist to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_admin_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_customer_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create separate triggers for admin and customer account creation
CREATE TRIGGER on_auth_admin_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin_profile();

CREATE TRIGGER on_auth_customer_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer_account();