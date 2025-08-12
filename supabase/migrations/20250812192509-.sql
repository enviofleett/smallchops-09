-- Phase 1: Database Migration - Disable trigger, migrate references, re-enable
-- Temporarily disable order validation trigger for migration

-- Disable the validation trigger
DROP TRIGGER IF EXISTS validate_order_status_trigger ON orders;

-- Update payment references for all orders with pay_ format
UPDATE orders 
SET 
  payment_reference = 'txn_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || gen_random_uuid()::text,
  paystack_reference = 'txn_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || gen_random_uuid()::text,
  updated_at = NOW()
WHERE 
  payment_reference LIKE 'pay_%' 
  OR paystack_reference LIKE 'pay_%'
  OR payment_reference IS NULL;

-- Update payment transactions table to use new references
UPDATE payment_transactions 
SET 
  provider_reference = 'txn_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || gen_random_uuid()::text,
  updated_at = NOW()
WHERE 
  provider_reference LIKE 'pay_%';

-- Re-enable the validation trigger
CREATE TRIGGER validate_order_status_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_update();

-- Create audit log of the migration
INSERT INTO audit_logs (
  action,
  category, 
  message,
  new_values
) VALUES (
  'payment_reference_migration_success',
  'Security',
  'Successfully migrated all pay_ references to secure txn_ format for production security',
  jsonb_build_object(
    'migration_date', NOW(),
    'orders_migrated', (SELECT COUNT(*) FROM orders WHERE payment_reference LIKE 'txn_%'),
    'security_level', 'critical',
    'reference_format', 'txn_timestamp_uuid',
    'trigger_management', 'temporarily_disabled_for_migration'
  )
);