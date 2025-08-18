
-- 1) Create/align the public.customer_accounts table to match app + edge functions

CREATE TABLE IF NOT EXISTS public.customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  name text NOT NULL,
  phone text,
  avatar_url text,
  bio text,
  date_of_birth date,
  email_verified boolean DEFAULT false,
  phone_verified boolean DEFAULT false,
  email_verification_token text,
  email_verification_expires_at timestamptz,
  profile_completion_percentage integer DEFAULT 0,
  last_order_date timestamptz,
  marketing_consent boolean DEFAULT false,
  reactivation_email_sent timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add/patch columns if migrating from older structure
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS email_verification_token text;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamptz;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS profile_completion_percentage integer DEFAULT 0;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS last_order_date timestamptz;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS marketing_consent boolean DEFAULT false;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS reactivation_email_sent timestamptz;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure user_id is nullable (some flows create the account first, then link user_id)
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.customer_accounts ALTER COLUMN user_id DROP NOT NULL;
  EXCEPTION WHEN others THEN
    NULL;
  END;
END$$;

-- Relax phone constraints if previously enforced too strictly
ALTER TABLE public.customer_accounts DROP CONSTRAINT IF EXISTS phone_format_check;
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.customer_accounts ALTER COLUMN phone DROP NOT NULL;
  EXCEPTION WHEN others THEN
    NULL;
  END;
END$$;

-- Constraints and indexes
ALTER TABLE public.customer_accounts
  ADD CONSTRAINT customer_accounts_user_id_key UNIQUE (user_id);

-- Unique email (case-insensitive) when present
CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_email_unique
  ON public.customer_accounts (lower(email))
  WHERE email IS NOT NULL;

-- 2) RLS policies (production-safe)

ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

-- Clean old policies if present
DROP POLICY IF EXISTS "Customers can view their own account" ON public.customer_accounts;
DROP POLICY IF EXISTS "Customers can update their own account" ON public.customer_accounts;
DROP POLICY IF EXISTS "Customers can delete their own account" ON public.customer_accounts;
DROP POLICY IF EXISTS "Customers can insert their own account" ON public.customer_accounts;
DROP POLICY IF EXISTS "Admins can view all customer accounts" ON public.customer_accounts;
DROP POLICY IF EXISTS "Service roles can manage customer accounts" ON public.customer_accounts;

-- Customers manage their own via user_id
CREATE POLICY "Customers can view their own account"
  ON public.customer_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Customers can update their own account"
  ON public.customer_accounts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Customers can delete their own account"
  ON public.customer_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Customers can insert their own account"
  ON public.customer_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin read access
CREATE POLICY "Admins can view all customer accounts"
  ON public.customer_accounts
  FOR SELECT
  USING (is_admin());

-- Service role full access (for edge functions and automations)
CREATE POLICY "Service roles can manage customer accounts"
  ON public.customer_accounts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3) Keep updated_at current
DROP TRIGGER IF EXISTS set_customer_accounts_updated_at ON public.customer_accounts;
CREATE TRIGGER set_customer_accounts_updated_at
  BEFORE UPDATE ON public.customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

-- 4) Non-blocking trigger on auth.users to insert/update customer_accounts at signup

CREATE OR REPLACE FUNCTION public.handle_new_customer_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $fn$
BEGIN
  INSERT INTO public.customer_accounts (user_id, email, name, phone, email_verified, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    (NEW.email_confirmed_at IS NOT NULL),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.customer_accounts.name),
    phone = COALESCE(EXCLUDED.phone, public.customer_accounts.phone),
    email_verified = public.customer_accounts.email_verified OR EXCLUDED.email_verified,
    updated_at = NOW();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Never block signup; log and continue
  INSERT INTO public.audit_logs (action, category, message, user_id, new_values)
  VALUES (
    'handle_new_customer_auth_failed',
    'Authentication',
    'Non-blocking: handle_new_customer_auth failed: ' || SQLERRM,
    NEW.id,
    jsonb_build_object('email', NEW.email)
  );
  RETURN NEW;
END;
$fn$;

-- Remove old triggers if present to avoid duplicates
DROP TRIGGER IF EXISTS on_customer_signup ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_customer ON auth.users;

-- Create the hardened trigger
CREATE TRIGGER on_auth_user_created_customer
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_customer_auth();

-- 5) Backfill existing auth users into customer_accounts (idempotent)

-- Ensure auth-linked rows have email correct
UPDATE public.customer_accounts ca
SET email = au.email,
    updated_at = NOW()
FROM auth.users au
WHERE ca.user_id = au.id
  AND (ca.email IS DISTINCT FROM au.email);

-- Insert missing rows for users without a customer_accounts record
INSERT INTO public.customer_accounts (user_id, email, name, phone, email_verified, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', au.email),
  au.raw_user_meta_data->>'phone',
  (au.email_confirmed_at IS NOT NULL),
  NOW(),
  NOW()
FROM auth.users au
LEFT JOIN public.customer_accounts ca
  ON ca.user_id = au.id
WHERE ca.id IS NULL;
