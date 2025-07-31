-- Phase 1: Fix RLS Policies for Customer Registration
-- Add policy to allow public insertions for guest registration
CREATE POLICY "Public can insert customers for guest checkout" 
ON public.customers 
FOR INSERT 
WITH CHECK (true);

-- Add policy to allow service role operations for public API
CREATE POLICY "Service role can manage customers" 
ON public.customers 
FOR ALL 
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Phase 2: Add Database Triggers for Customer Account Creation
-- Create trigger function to auto-create customer_accounts when users sign up via auth
CREATE OR REPLACE FUNCTION public.handle_new_customer_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create customer_accounts record when user signs up via auth
  INSERT INTO public.customer_accounts (user_id, name, phone)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$function$;

-- Create trigger for auth user creation (separate from existing handle_new_user)
CREATE TRIGGER on_auth_user_created_customer
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_customer_auth();

-- Add function to link guest customers with authenticated accounts
CREATE OR REPLACE FUNCTION public.link_guest_to_authenticated_customer(
  p_email text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update existing customer record to link with authenticated user
  UPDATE public.customers 
  SET updated_at = now()
  WHERE email = p_email;
  
  -- Create customer_accounts record if it doesn't exist
  INSERT INTO public.customer_accounts (user_id, name, phone)
  SELECT 
    p_user_id,
    c.name,
    c.phone
  FROM public.customers c
  WHERE c.email = p_email
  ON CONFLICT (user_id) DO NOTHING;
END;
$function$;