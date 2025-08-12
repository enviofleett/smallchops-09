-- ========================================
-- 🔧 EMERGENCY PAYMENT REFERENCE CACHE RESOLUTION PLAN
-- Phase 2: Backend Reference Authority Enforcement
-- ========================================

-- Add constraint to prevent any non-txn references in future orders
ALTER TABLE orders ADD CONSTRAINT orders_valid_payment_reference_format 
CHECK (payment_reference IS NULL OR payment_reference ~ '^txn_[0-9]{13}_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$');

-- Create monitoring view for invalid references
CREATE OR REPLACE VIEW payment_reference_alerts AS
SELECT 
  id AS order_id,
  order_number,
  payment_reference,
  paystack_reference,
  created_at,
  payment_status,
  'INVALID_REFERENCE_FORMAT' AS alert_type,
  CASE 
    WHEN payment_reference LIKE 'pay_%' THEN 'CLIENT_GENERATED_REFERENCE'
    WHEN payment_reference LIKE 'checkout_%' THEN 'OLD_CHECKOUT_REFERENCE'
    ELSE 'UNKNOWN_FORMAT'
  END AS reference_issue
FROM orders
WHERE payment_reference IS NOT NULL
  AND payment_reference !~ '^txn_[0-9]{13}_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  AND created_at > NOW() - INTERVAL '7 days';

-- Function to fix orders with invalid references 
CREATE OR REPLACE FUNCTION fix_invalid_payment_references()
RETURNS TABLE(
  fixed_order_id UUID,
  old_reference TEXT,
  new_reference TEXT
) AS $$
DECLARE
  order_rec RECORD;
  new_ref TEXT;
BEGIN
  FOR order_rec IN 
    SELECT id, payment_reference, created_at 
    FROM orders 
    WHERE payment_reference IS NOT NULL 
      AND payment_reference !~ '^txn_[0-9]{13}_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
      AND payment_status = 'pending'
      AND created_at > NOW() - INTERVAL '48 hours'
  LOOP
    -- Generate new backend-style reference
    new_ref := 'txn_' || (EXTRACT(EPOCH FROM order_rec.created_at) * 1000)::bigint || '_' || order_rec.id::text;
    
    -- Update the order
    UPDATE orders 
    SET 
      payment_reference = new_ref,
      paystack_reference = new_ref,
      updated_at = NOW()
    WHERE id = order_rec.id;
    
    -- Return results
    fixed_order_id := order_rec.id;
    old_reference := order_rec.payment_reference;
    new_reference := new_ref;
    RETURN NEXT;
    
    -- Log the fix
    INSERT INTO audit_logs (
      action,
      category,
      message,
      new_values
    ) VALUES (
      'emergency_reference_fix',
      'Payment Recovery',
      'Fixed invalid payment reference format: ' || order_rec.payment_reference || ' -> ' || new_ref,
      jsonb_build_object(
        'order_id', order_rec.id,
        'old_reference', order_rec.payment_reference,
        'new_reference', new_ref,
        'fix_reason', 'Invalid reference format detected'
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Phase 3: Current Order Recovery - Check for the specific order mentioned in audit
-- Look for the order that had payment reference: pay_1755020881006_zo5vbldke

DO $$
DECLARE
  problem_order_id UUID;
  new_txn_ref TEXT;
BEGIN
  -- Find the order with the problematic reference
  SELECT id INTO problem_order_id
  FROM orders 
  WHERE payment_reference = 'pay_1755020881006_zo5vbldke'
     OR order_number = 'ORD-20250812-1434'
  LIMIT 1;
  
  IF problem_order_id IS NOT NULL THEN
    -- Generate proper txn_ reference
    new_txn_ref := 'txn_1755020881006_' || problem_order_id::text;
    
    -- Update the order
    UPDATE orders 
    SET 
      payment_reference = new_txn_ref,
      paystack_reference = new_txn_ref,
      updated_at = NOW()
    WHERE id = problem_order_id;
    
    -- Log the specific fix
    INSERT INTO audit_logs (
      action,
      category,
      message,
      new_values
    ) VALUES (
      'emergency_order_recovery',
      'Payment Recovery',
      'Fixed order ORD-20250812-1434 payment reference',
      jsonb_build_object(
        'order_id', problem_order_id,
        'old_reference', 'pay_1755020881006_zo5vbldke',
        'new_reference', new_txn_ref,
        'order_number', 'ORD-20250812-1434',
        'recovery_reason', 'Emergency cache resolution plan'
      )
    );
    
    RAISE NOTICE 'Fixed order % with new reference %', problem_order_id, new_txn_ref;
  ELSE
    RAISE NOTICE 'Order with reference pay_1755020881006_zo5vbldke not found';
  END IF;
END $$;

-- Create trigger to prevent future invalid references
CREATE OR REPLACE FUNCTION prevent_invalid_payment_references()
RETURNS TRIGGER AS $$
BEGIN
  -- Block any pay_ references
  IF NEW.payment_reference IS NOT NULL AND NEW.payment_reference LIKE 'pay_%' THEN
    RAISE EXCEPTION 'Client-generated payment references are not allowed. Use backend-generated txn_ format only.';
  END IF;
  
  -- Log any attempts to use invalid references
  IF NEW.payment_reference IS NOT NULL AND NEW.payment_reference !~ '^txn_[0-9]{13}_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN
    INSERT INTO audit_logs (
      action,
      category,
      message,
      new_values
    ) VALUES (
      'invalid_reference_blocked',
      'Security',
      'Blocked attempt to use invalid payment reference: ' || NEW.payment_reference,
      jsonb_build_object(
        'blocked_reference', NEW.payment_reference,
        'order_id', NEW.id,
        'timestamp', NOW()
      )
    );
    
    RAISE EXCEPTION 'Invalid payment reference format. Only backend-generated txn_ references are allowed.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to orders table
DROP TRIGGER IF EXISTS prevent_invalid_payment_references_trigger ON orders;
CREATE TRIGGER prevent_invalid_payment_references_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION prevent_invalid_payment_references();

-- Execute the fix for all invalid references
SELECT fix_invalid_payment_references();