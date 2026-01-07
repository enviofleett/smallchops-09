-- =====================================================
-- SECURITY FIX: Customer Accounts Public Exposure
-- =====================================================
-- Problem: The 'public can read reviewer names (active reviews only)' policy
-- allows unauthenticated users to see ALL columns including email, phone, DOB
-- for any customer who has written a review. This exposes PII.
-- 
-- Solution: Drop the overly permissive policy. Reviews should join to customer
-- accounts only via backend/admin queries, or use a security definer function
-- that returns only the reviewer's name.
-- =====================================================

-- Step 1: Drop the problematic public access policy
DROP POLICY IF EXISTS "public can read reviewer names (active reviews only)" ON public.customer_accounts;

-- Step 2: Create a secure function to get reviewer name only (no PII exposure)
-- This function returns ONLY the name for display in reviews, nothing else
CREATE OR REPLACE FUNCTION public.get_reviewer_display_name(p_customer_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    CASE 
      WHEN name IS NOT NULL AND length(name) > 0 THEN name
      ELSE 'Anonymous'
    END,
    'Anonymous'
  )
  FROM public.customer_accounts
  WHERE id = p_customer_id
  LIMIT 1;
$$;

-- Grant execute permission to public so reviews can display names
GRANT EXECUTE ON FUNCTION public.get_reviewer_display_name(uuid) TO public;
GRANT EXECUTE ON FUNCTION public.get_reviewer_display_name(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_reviewer_display_name(uuid) TO authenticated;

-- Step 3: Also clean up redundant/conflicting policies on customer_accounts
-- Keep only the essential, secure policies

-- Remove duplicate admin policies (keep the comprehensive ones)
DROP POLICY IF EXISTS "Admins can view all customer accounts" ON public.customer_accounts;
DROP POLICY IF EXISTS "Admins can view customer accounts (dashboard)" ON public.customer_accounts;

-- The following policies are kept and are secure:
-- - "Admin and service role access to customer accounts" - admin/service_role only
-- - "Admins can manage all customer accounts" - admin only  
-- - "Service roles can manage customer accounts" - service_role only
-- - "Users can view their own account" - owner only (authenticated)
-- - "Users can update their own account" - owner only (authenticated)
-- - "customer can update own account" - owner only
-- - "customer_accounts_production_access" - owner or admin only
-- - "customer_accounts_production_insert" - owner only
-- - "customer_accounts_production_update" - owner or admin only
-- - "customers_can_view_own_account" - owner only
-- - "customers_manage_own_account_safe" - owner only (authenticated)

-- Step 4: Add comment documenting the security fix
COMMENT ON FUNCTION public.get_reviewer_display_name(uuid) IS 
'Secure function to get only the display name for a reviewer. Returns only the name field, 
no PII (email, phone, DOB) is exposed. Use this in product_reviews queries instead of 
direct joins to customer_accounts table.';