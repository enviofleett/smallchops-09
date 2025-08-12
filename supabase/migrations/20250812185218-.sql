-- Fix existing orders with pay_ references by converting to proper txn_ format
-- This migration fixes the critical payment reference issue

-- Step 1: Update orders with pay_ references to proper txn_ format
UPDATE orders 
SET 
  payment_reference = CASE 
    WHEN payment_reference LIKE 'pay_%' THEN 
      'txn_' || EXTRACT(EPOCH FROM created_at)::bigint || '_' || id
    ELSE payment_reference
  END,
  paystack_reference = CASE 
    WHEN paystack_reference LIKE 'pay_%' THEN 
      'txn_' || EXTRACT(EPOCH FROM created_at)::bigint || '_' || id
    ELSE paystack_reference
  END,
  updated_at = NOW()
WHERE payment_reference LIKE 'pay_%' 
   OR paystack_reference LIKE 'pay_%';

-- Step 2: Specifically fix the pending order ORD-20250812-1434
UPDATE orders 
SET 
  payment_reference = 'txn_1755020881006_' || id,
  paystack_reference = 'pay_1755020881006_zo5vbldke', -- Keep original Paystack ref for verification
  updated_at = NOW()
WHERE order_number = 'ORD-20250812-1434';

-- Step 3: Create audit log of the reference migration
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'payment_reference_migration',
  'Payment Security',
  'Migrated all pay_ references to secure txn_ format to fix payment validation',
  jsonb_build_object(
    'migration_date', NOW(),
    'fixed_orders', (
      SELECT COUNT(*) FROM orders 
      WHERE payment_reference LIKE 'txn_%' 
        AND updated_at >= NOW() - INTERVAL '1 minute'
    ),
    'security_issue', 'frontend_reference_generation'
  )
);

-- Step 4: Add constraint to prevent future pay_ references (temporarily disabled for now)
-- This will be enforced at the application level initially
COMMENT ON COLUMN orders.payment_reference IS 'Payment reference - must start with txn_ (backend-generated only)';
COMMENT ON COLUMN orders.paystack_reference IS 'Original Paystack reference for verification purposes';