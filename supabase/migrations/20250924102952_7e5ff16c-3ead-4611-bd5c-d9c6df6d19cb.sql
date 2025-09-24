-- CRITICAL FIX: Payment Verification Database Schema Issue - Step 1
-- Fix the audit trigger function first before changing constraints

-- Step 1: Update the audit_order_changes trigger function to handle system operations
CREATE OR REPLACE FUNCTION audit_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  admin_name TEXT;
BEGIN
  -- Skip audit for unchanged orders
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get admin name if admin ID exists
  IF NEW.updated_by IS NOT NULL THEN
    SELECT COALESCE(display_name, email, 'Unknown Admin') INTO admin_name
    FROM profiles 
    WHERE id = NEW.updated_by;
  ELSE
    admin_name := 'System';
  END IF;
  
  -- Insert audit record with proper system_source handling
  INSERT INTO order_audit (
    order_id, 
    admin_id, 
    admin_name, 
    old_status, 
    new_status, 
    action_type,
    system_source,
    created_at
  ) VALUES (
    NEW.id, 
    NEW.updated_by, 
    admin_name, 
    OLD.status, 
    NEW.status, 
    'status_update',
    CASE 
      WHEN NEW.updated_by IS NULL THEN 'automated_system'
      ELSE NULL 
    END,
    now()
  );
  
  RETURN NEW;
END;
$$;

-- Step 2: Make admin_id nullable in order_audit table
ALTER TABLE order_audit ALTER COLUMN admin_id DROP NOT NULL;

-- Step 3: Add system_source column if it doesn't exist
ALTER TABLE order_audit ADD COLUMN IF NOT EXISTS system_source TEXT DEFAULT NULL;

-- Step 4: Add constraint to ensure either admin_id or system_source is provided
ALTER TABLE order_audit ADD CONSTRAINT order_audit_admin_or_system_check 
CHECK (
  (admin_id IS NOT NULL) OR 
  (system_source IS NOT NULL)
);

-- Step 5: Create index for performance
CREATE INDEX IF NOT EXISTS idx_order_audit_system_source ON order_audit(system_source) WHERE system_source IS NOT NULL;

-- Step 6: Log the fix
INSERT INTO audit_logs (action, category, message, user_id, new_values)
VALUES (
  'payment_verification_schema_fix_step1',
  'Payment System',
  'STEP 1: Fixed audit trigger to support automated payment verification',
  auth.uid(),
  jsonb_build_object(
    'change', 'Updated audit_order_changes function and made admin_id nullable',
    'reason', 'Payment verification was failing due to NOT NULL constraint on admin_id'
  )
);