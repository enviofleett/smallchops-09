-- Ensure customer_accounts table has proper RLS policies for profile updates

-- Enable RLS if not already enabled
ALTER TABLE customer_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
DROP POLICY IF EXISTS "Users can view their own account" ON customer_accounts;
DROP POLICY IF EXISTS "Users can update their own account" ON customer_accounts;

-- Policy: Users can view their own account
CREATE POLICY "Users can view their own account"
ON customer_accounts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can update their own account (with restrictions)
CREATE POLICY "Users can update their own account"
ON customer_accounts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger if not exists
CREATE OR REPLACE FUNCTION update_customer_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_customer_accounts_updated_at ON customer_accounts;
CREATE TRIGGER set_customer_accounts_updated_at
  BEFORE UPDATE ON customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_accounts_updated_at();

-- Create audit log for customer profile updates
CREATE TABLE IF NOT EXISTS customer_profile_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  changed_fields JSONB NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Enable RLS on audit table
ALTER TABLE customer_profile_audit ENABLE ROW LEVEL SECURITY;

-- Drop and recreate audit policy
DROP POLICY IF EXISTS "Users can view their own audit logs" ON customer_profile_audit;

-- Policy: Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs"
ON customer_profile_audit
FOR SELECT
TO authenticated
USING (customer_id IN (
  SELECT id FROM customer_accounts WHERE user_id = auth.uid()
));

-- Trigger to log profile changes
CREATE OR REPLACE FUNCTION log_customer_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_changed_fields JSONB := '{}'::jsonb;
  v_old_values JSONB := '{}'::jsonb;
  v_new_values JSONB := '{}'::jsonb;
BEGIN
  -- Track which fields changed
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    v_changed_fields := v_changed_fields || jsonb_build_object('name', true);
    v_old_values := v_old_values || jsonb_build_object('name', OLD.name);
    v_new_values := v_new_values || jsonb_build_object('name', NEW.name);
  END IF;
  
  IF OLD.phone IS DISTINCT FROM NEW.phone THEN
    v_changed_fields := v_changed_fields || jsonb_build_object('phone', true);
    v_old_values := v_old_values || jsonb_build_object('phone', OLD.phone);
    v_new_values := v_new_values || jsonb_build_object('phone', NEW.phone);
  END IF;
  
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    v_changed_fields := v_changed_fields || jsonb_build_object('email', true);
    v_old_values := v_old_values || jsonb_build_object('email', OLD.email);
    v_new_values := v_new_values || jsonb_build_object('email', NEW.email);
  END IF;

  -- Only log if something actually changed
  IF v_changed_fields <> '{}'::jsonb THEN
    INSERT INTO customer_profile_audit (
      customer_id,
      changed_fields,
      old_values,
      new_values
    ) VALUES (
      NEW.id,
      v_changed_fields,
      v_old_values,
      v_new_values
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS customer_profile_audit_trigger ON customer_accounts;
CREATE TRIGGER customer_profile_audit_trigger
  AFTER UPDATE ON customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION log_customer_profile_changes();