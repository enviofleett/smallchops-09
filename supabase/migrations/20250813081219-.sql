-- PHASE 1: EMERGENCY PAYSTACK-ONLY MIGRATION & STRIPE REMOVAL (FIXED)
-- ================================================================

-- Drop Stripe references from payment_transactions
ALTER TABLE public.payment_transactions 
  DROP CONSTRAINT IF EXISTS chk_provider_valid;

-- Add constraint to only allow Paystack
ALTER TABLE public.payment_transactions 
  ADD CONSTRAINT chk_provider_paystack_only 
  CHECK (provider = 'paystack');

-- Update any existing Stripe records to Paystack (if any)
UPDATE public.payment_transactions 
SET provider = 'paystack' 
WHERE provider = 'stripe';

-- Enforce backend-only reference generation with txn_ prefix (fixed syntax)
ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS chk_reference_prefix;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT chk_reference_prefix 
  CHECK (provider_reference LIKE 'txn_%' OR provider_reference IS NULL);

-- Block pay_ references entirely in orders table
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS chk_orders_no_pay_prefix;

ALTER TABLE public.orders
  ADD CONSTRAINT chk_orders_no_pay_prefix 
  CHECK (payment_reference IS NULL OR payment_reference NOT LIKE 'pay_%');

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS chk_paystack_ref_no_pay_prefix;

ALTER TABLE public.orders
  ADD CONSTRAINT chk_paystack_ref_no_pay_prefix 
  CHECK (paystack_reference IS NULL OR paystack_reference NOT LIKE 'pay_%');

-- Secure business_settings table (remove public access)
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Drop any existing public read policies
DROP POLICY IF EXISTS "Public can view business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Anyone can read business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Public read access" ON public.business_settings;

-- Create admin-only policy for business_settings
CREATE POLICY "Admins only can access business settings" ON public.business_settings
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

-- Remove provider column default to Stripe if it exists
ALTER TABLE public.saved_payment_methods 
  ALTER COLUMN provider SET DEFAULT 'paystack';

-- Update any existing Stripe saved methods to Paystack
UPDATE public.saved_payment_methods 
SET provider = 'paystack' 
WHERE provider = 'stripe';

-- Add constraint to only allow Paystack for saved methods
ALTER TABLE public.saved_payment_methods
  DROP CONSTRAINT IF EXISTS chk_saved_methods_paystack_only;

ALTER TABLE public.saved_payment_methods
  ADD CONSTRAINT chk_saved_methods_paystack_only 
  CHECK (provider = 'paystack');