
-- 1) Backfill missing emails into customer_accounts where possible
UPDATE public.customer_accounts AS ca
SET email = au.email
FROM auth.users AS au
WHERE ca.user_id = au.id
  AND ca.email IS NULL
  AND au.email IS NOT NULL;

-- 2) Relax the NOT NULL constraint on email to restore prior tolerant behavior
--    (keeps the unique constraint if it already exists)
ALTER TABLE public.customer_accounts
  ALTER COLUMN email DROP NOT NULL;

-- 3) Remove the AFTER UPDATE trigger so logins no longer touch customer_accounts
DROP TRIGGER IF EXISTS on_auth_customer_user_updated ON auth.users;
