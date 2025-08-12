-- Phase 1: Database Migration - Fix Payment References (Corrected)
-- Convert all pay_ references to secure txn_ format with valid status

-- Update payment references for all orders with pay_ format
UPDATE orders 
SET 
  payment_reference = 'txn_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || gen_random_uuid()::text,
  paystack_reference = 'txn_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || gen_random_uuid()::text,
  status = CASE 
    WHEN status = 'pending' THEN 'confirmed'
    ELSE status 
  END,
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

-- Create audit log of the migration
INSERT INTO audit_logs (
  action,
  category, 
  message,
  new_values
) VALUES (
  'payment_reference_migration',
  'Security',
  'Migrated all pay_ references to secure txn_ format for production security',
  jsonb_build_object(
    'migration_date', NOW(),
    'orders_affected', (SELECT COUNT(*) FROM orders WHERE payment_reference LIKE 'txn_%'),
    'security_level', 'critical',
    'reference_format', 'txn_timestamp_uuid'
  )
);