-- Update customer_accounts table to work with Supabase Auth
-- Make email unique and not nullable
ALTER TABLE public.customer_accounts 
  ALTER COLUMN email SET NOT NULL;

-- Add unique constraint on email if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customer_accounts_email_key'
  ) THEN
    ALTER TABLE public.customer_accounts ADD CONSTRAINT customer_accounts_email_key UNIQUE (email);
  END IF;
END $$;

-- Add foreign key constraint to auth.users if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customer_accounts_user_id_fkey'
  ) THEN
    ALTER TABLE public.customer_accounts 
    ADD CONSTRAINT customer_accounts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make user_id unique if not already
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customer_accounts_user_id_key'
  ) THEN
    ALTER TABLE public.customer_accounts ADD CONSTRAINT customer_accounts_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Create policies for customer accounts (using user_id instead of supabase_user_id)
DROP POLICY IF EXISTS "Users can view their own customer account" ON public.customer_accounts;
CREATE POLICY "Users can view their own customer account" 
ON public.customer_accounts 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own customer account" ON public.customer_accounts;
CREATE POLICY "Users can update their own customer account" 
ON public.customer_accounts 
FOR UPDATE 
USING (auth.uid() = user_id);

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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_accounts_email ON public.customer_accounts(email);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_user_id ON public.customer_accounts(user_id);