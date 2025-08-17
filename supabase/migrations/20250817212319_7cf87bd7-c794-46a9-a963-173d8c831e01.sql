-- Check if customer_accounts table exists and create/update as needed
CREATE TABLE IF NOT EXISTS public.customer_accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    supabase_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for customer accounts
DROP POLICY IF EXISTS "Users can view their own customer account" ON public.customer_accounts;
CREATE POLICY "Users can view their own customer account" 
ON public.customer_accounts 
FOR SELECT 
USING (auth.uid() = supabase_user_id);

DROP POLICY IF EXISTS "Users can update their own customer account" ON public.customer_accounts;
CREATE POLICY "Users can update their own customer account" 
ON public.customer_accounts 
FOR UPDATE 
USING (auth.uid() = supabase_user_id);

-- Admins can view all customer accounts
DROP POLICY IF EXISTS "Admins can view all customer accounts" ON public.customer_accounts;
CREATE POLICY "Admins can view all customer accounts" 
ON public.customer_accounts 
FOR SELECT 
TO authenticated
USING (is_admin());

-- Service role can insert and update customer accounts
DROP POLICY IF EXISTS "Service role can insert customer accounts" ON public.customer_accounts;
CREATE POLICY "Service role can insert customer accounts" 
ON public.customer_accounts 
FOR INSERT 
TO service_role 
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update customer accounts" ON public.customer_accounts;
CREATE POLICY "Service role can update customer accounts" 
ON public.customer_accounts 
FOR UPDATE 
TO service_role 
USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_customer_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customer_accounts_updated_at ON public.customer_accounts;
CREATE TRIGGER update_customer_accounts_updated_at
  BEFORE UPDATE ON public.customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_accounts_updated_at();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_customer_accounts_email ON public.customer_accounts(email);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_supabase_user_id ON public.customer_accounts(supabase_user_id);