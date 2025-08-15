-- Step 1: Temporarily relax the constraint to allow both txn_ and pay_ prefixes during transition
-- This prevents immediate checkout failures while we implement the permanent solution

-- Drop the existing strict constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_no_pay_prefix;

-- Add a more flexible constraint that allows both formats during transition
ALTER TABLE orders ADD CONSTRAINT chk_orders_payment_reference_format
CHECK (
  payment_reference IS NULL OR
  payment_reference ~ '^(txn_|pay_)[0-9]+_[a-zA-Z0-9\-]+$'
);

-- Add a comment explaining the temporary nature
COMMENT ON CONSTRAINT chk_orders_payment_reference_format ON orders IS 
'Temporary constraint allowing both txn_ and pay_ prefixes during payment system migration. Will be updated to only allow txn_ prefixes once migration is complete.';