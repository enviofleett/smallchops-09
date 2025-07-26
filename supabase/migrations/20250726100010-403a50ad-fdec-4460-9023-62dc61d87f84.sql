-- Create customers table for authenticated customer accounts
CREATE TABLE IF NOT EXISTS public.customer_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

-- Customers can only view and update their own accounts
CREATE POLICY "Customers can view their own account" 
ON public.customer_accounts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Customers can update their own account" 
ON public.customer_accounts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Customers can insert their own account" 
ON public.customer_accounts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Staff can view all customer accounts
CREATE POLICY "Staff can view all customer accounts" 
ON public.customer_accounts 
FOR SELECT 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text]));

-- Update customer_favorites to reference customer_accounts
ALTER TABLE public.customer_favorites 
DROP CONSTRAINT IF EXISTS customer_favorites_customer_id_fkey;

-- Add foreign key to customer_accounts
ALTER TABLE public.customer_favorites 
ADD CONSTRAINT customer_favorites_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES public.customer_accounts(id) ON DELETE CASCADE;

-- Update RLS policies for customer_favorites
DROP POLICY IF EXISTS "Service role can manage all favorites" ON public.customer_favorites;
DROP POLICY IF EXISTS "Staff can view all favorites" ON public.customer_favorites;

-- Customers can manage their own favorites
CREATE POLICY "Customers can manage their own favorites" 
ON public.customer_favorites 
FOR ALL 
USING (customer_id IN (SELECT id FROM public.customer_accounts WHERE user_id = auth.uid()));

-- Staff can view all favorites
CREATE POLICY "Staff can view all customer favorites" 
ON public.customer_favorites 
FOR SELECT 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text]));

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL, -- IP address or user ID
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(identifier, endpoint, window_start)
);

-- Enable RLS
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can manage rate limits
CREATE POLICY "Service role can manage rate limits" 
ON public.api_rate_limits 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create function to handle new customer registration
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-create customer account when user signs up
  INSERT INTO public.customer_accounts (user_id, name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new customer registration
DROP TRIGGER IF EXISTS on_customer_signup ON auth.users;
CREATE TRIGGER on_customer_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  WHEN (NEW.email IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_customer();

-- Add updated_at trigger
CREATE TRIGGER update_customer_accounts_updated_at
  BEFORE UPDATE ON public.customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();