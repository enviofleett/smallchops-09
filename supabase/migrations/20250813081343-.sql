-- PHASE 1: PAYSTACK-ONLY MIGRATION & STRIPE REMOVAL (CORRECTED)
-- ================================================================

-- payment_transactions table doesn't have a provider column, so we'll work with provider_reference
-- Enforce backend-only reference generation with txn_ prefix
ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS chk_reference_prefix;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT chk_reference_prefix 
  CHECK (provider_reference IS NULL OR provider_reference LIKE 'txn_%');

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

-- Update saved_payment_methods to only allow Paystack
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

-- Create function to generate backend-only payment references
CREATE OR REPLACE FUNCTION public.generate_secure_payment_reference()
RETURNS TEXT AS $$
BEGIN
  RETURN 'txn_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || gen_random_uuid()::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log the cleanup action
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'paystack_only_migration_phase1',
  'Payment System',
  'Completed Phase 1: Stripe removal and Paystack-only migration with backend-only reference generation',
  jsonb_build_object(
    'stripe_removed', true,
    'paystack_only', true,
    'backend_references_only', true,
    'security_hardened', true,
    'migration_timestamp', NOW()
  )
);