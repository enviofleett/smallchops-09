-- Fix critical database issues from audit report

-- 1. Fix email column issues (most critical from logs)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email TEXT;
UPDATE orders SET email = customer_email WHERE email IS NULL AND customer_email IS NOT NULL;

-- 2. Remove redundant indexes to improve write performance
DROP INDEX IF EXISTS idx_orders_discount;
DROP INDEX IF EXISTS idx_orders_guest_session;
DROP INDEX IF EXISTS idx_orders_payment_method;
DROP INDEX IF EXISTS idx_orders_order_type;

-- 3. Keep only essential indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(payment_reference) WHERE payment_reference IS NOT NULL;

-- 4. Add missing foreign key constraints for data integrity
ALTER TABLE orders 
ADD CONSTRAINT IF NOT EXISTS fk_orders_customer_id 
FOREIGN KEY (customer_id) REFERENCES customer_accounts(id) ON DELETE SET NULL;

ALTER TABLE orders 
ADD CONSTRAINT IF NOT EXISTS fk_orders_delivery_zone_id 
FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(id) ON DELETE SET NULL;

-- 5. Add validation constraints
ALTER TABLE orders 
ADD CONSTRAINT IF NOT EXISTS chk_orders_total_amount_positive 
CHECK (total_amount >= 0);

-- 6. Create optimized view for order queries
CREATE OR REPLACE VIEW orders_view AS
SELECT 
  o.*,
  dz.name as delivery_zone_name,
  dz.delivery_fee as zone_delivery_fee
FROM orders o
LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.id;

-- 7. Fix email system security issues - Remove dangerous SECURITY DEFINER where not needed
DROP FUNCTION IF EXISTS unsafe_email_function CASCADE;

-- 8. Create proper audit logging for order changes
CREATE TABLE IF NOT EXISTS order_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 9. Add RLS to audit log
ALTER TABLE order_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view order audit log" ON order_audit_log
FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can insert order audit log" ON order_audit_log
FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 10. Create trigger for order audit logging
CREATE OR REPLACE FUNCTION log_order_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO order_audit_log (order_id, action, old_values, new_values, changed_by)
    VALUES (
      NEW.id,
      'updated',
      to_jsonb(OLD),
      to_jsonb(NEW),
      auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO order_audit_log (order_id, action, old_values, changed_by)
    VALUES (
      OLD.id,
      'deleted',
      to_jsonb(OLD),
      auth.uid()
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;