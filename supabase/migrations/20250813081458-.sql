-- PHASE 1A: Migrate existing pay_ references to txn_ format
-- ================================================================

-- Create function to convert pay_ to txn_ references
CREATE OR REPLACE FUNCTION public.migrate_pay_to_txn_reference(pay_ref TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Extract timestamp and suffix from pay_ reference 
  -- Format: pay_1754431121034_t5cl0r3j5 -> txn_1754431121034_<new_uuid>
  IF pay_ref LIKE 'pay_%' THEN
    -- Extract the timestamp part
    DECLARE
      timestamp_part TEXT;
      new_suffix TEXT;
    BEGIN
      timestamp_part := SPLIT_PART(SUBSTRING(pay_ref FROM 5), '_', 1);
      new_suffix := gen_random_uuid()::text;
      RETURN 'txn_' || timestamp_part || '_' || new_suffix;
    END;
  END IF;
  -- If not a pay_ reference, return as is
  RETURN pay_ref;
END;
$$ LANGUAGE plpgsql;

-- Update all pay_ references to txn_ format
UPDATE public.payment_transactions 
SET provider_reference = public.migrate_pay_to_txn_reference(provider_reference)
WHERE provider_reference LIKE 'pay_%';

-- Also update orders table to maintain consistency
UPDATE public.orders 
SET paystack_reference = public.migrate_pay_to_txn_reference(paystack_reference)
WHERE paystack_reference LIKE 'pay_%';

UPDATE public.orders 
SET payment_reference = public.migrate_pay_to_txn_reference(payment_reference)
WHERE payment_reference LIKE 'pay_%';

-- Log the migration
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'pay_to_txn_reference_migration',
  'Payment System',
  'Migrated all pay_ references to txn_ format for security compliance',
  jsonb_build_object(
    'migration_type', 'reference_format_update',
    'from_format', 'pay_',
    'to_format', 'txn_',
    'migration_timestamp', NOW()
  )
);