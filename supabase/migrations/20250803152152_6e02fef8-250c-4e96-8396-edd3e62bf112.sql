-- Add missing email column to customer_accounts table
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS email text;