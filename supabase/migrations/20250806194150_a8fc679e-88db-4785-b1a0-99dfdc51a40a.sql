-- Fix guest checkout by allowing NULL user_id in customer_accounts
-- This allows guest customers who don't have auth accounts

-- 1. Make user_id nullable in customer_accounts
ALTER TABLE public.customer_accounts 
ALTER COLUMN user_id DROP NOT NULL;

-- 2. Update the foreign key constraint to handle NULLs properly
-- Drop existing constraint first
ALTER TABLE public.customer_accounts 
DROP CONSTRAINT IF EXISTS customer_accounts_user_id_fkey;

-- Add new constraint that allows NULL values
ALTER TABLE public.customer_accounts 
ADD CONSTRAINT customer_accounts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Create or replace the findOrCreateCustomer function to handle guests
CREATE OR REPLACE FUNCTION public.find_or_create_customer(
  p_email text,
  p_name text,
  p_phone text DEFAULT NULL,
  p_is_guest boolean DEFAULT false
)
RETURNS TABLE(customer_id uuid, is_new boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_is_new boolean := false;
  v_user_id uuid := NULL;
BEGIN
  -- For registered users, get their user_id
  IF NOT p_is_guest THEN
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  END IF;
  
  -- Try to find existing customer by email
  SELECT id INTO v_customer_id
  FROM customer_accounts 
  WHERE email = p_email;
  
  IF v_customer_id IS NULL THEN
    -- Create new customer
    INSERT INTO customer_accounts (
      user_id,
      name, 
      email, 
      phone,
      email_verified,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,  -- NULL for guests, actual user_id for registered users
      p_name,
      p_email,
      p_phone,
      NOT p_is_guest,  -- Guests are not email verified
      now(),
      now()
    ) RETURNING id INTO v_customer_id;
    
    v_is_new := true;
    
    -- Log customer creation
    INSERT INTO audit_logs (
      action,
      category,
      message,
      new_values
    ) VALUES (
      'customer_created',
      'Customer Management',
      'Customer created: ' || p_email || ' (guest: ' || p_is_guest || ')',
      jsonb_build_object(
        'customer_id', v_customer_id,
        'email', p_email,
        'is_guest', p_is_guest,
        'has_user_id', v_user_id IS NOT NULL
      )
    );
  END IF;
  
  RETURN QUERY SELECT v_customer_id, v_is_new;
END;
$function$;

-- 4. Update RLS policies to handle NULL user_id for guest customers
DROP POLICY IF EXISTS "Customers can view their own account" ON customer_accounts;
DROP POLICY IF EXISTS "Customers can update their own account" ON customer_accounts;
DROP POLICY IF EXISTS "Customers can insert their own account" ON customer_accounts;

-- Allow customers to view their own account (registered users only)
CREATE POLICY "Customers can view their own account"
ON customer_accounts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow customers to update their own account (registered users only)  
CREATE POLICY "Customers can update their own account"
ON customer_accounts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Allow customers to insert their own account (registered users only)
CREATE POLICY "Customers can insert their own account"
ON customer_accounts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Service roles can manage all customer accounts (for guest checkout)
CREATE POLICY "Service roles can manage customer accounts"
ON customer_accounts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);