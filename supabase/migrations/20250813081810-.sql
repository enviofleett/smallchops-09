-- PHASE 1B: Apply Paystack-only constraints after migration
-- ================================================================

-- Now apply the txn_ prefix constraint since all references are migrated
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT chk_reference_prefix 
  CHECK (provider_reference IS NULL OR provider_reference LIKE 'txn_%');

-- Block pay_ references entirely in orders table  
ALTER TABLE public.orders
  ADD CONSTRAINT chk_orders_no_pay_prefix 
  CHECK (payment_reference IS NULL OR payment_reference NOT LIKE 'pay_%');

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
  ADD CONSTRAINT chk_saved_methods_paystack_only 
  CHECK (provider = 'paystack');

-- Create function to generate backend-only payment references
CREATE OR REPLACE FUNCTION public.generate_secure_payment_reference()
RETURNS TEXT AS $$
BEGIN
  RETURN 'txn_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || gen_random_uuid()::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Log the constraint application
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'paystack_constraints_applied',
  'Payment System',
  'Applied Paystack-only constraints and backend reference generation',
  jsonb_build_object(
    'constraints_applied', true,
    'paystack_only', true,
    'backend_references_enforced', true,
    'security_hardened', true,
    'migration_timestamp', NOW()
  )
);