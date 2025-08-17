-- First, update NULL email values with a default pattern
UPDATE public.customer_accounts 
SET email = 'customer_' || id::text || '@temp.local' 
WHERE email IS NULL;

-- Now make email NOT NULL
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