-- Fix critical database issues from audit report (corrected schema)

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

-- 4. Create optimized view for order queries (corrected column names)
CREATE OR REPLACE VIEW orders_view AS
SELECT 
  o.*,
  dz.name as delivery_zone_name,
  dz.base_fee as zone_delivery_fee
FROM orders o
LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.id;

-- 5. Create proper audit logging for order changes
CREATE TABLE IF NOT EXISTS order_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Add RLS to audit log
ALTER TABLE order_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view order audit log" ON order_audit_log;
CREATE POLICY "Admins can view order audit log" ON order_audit_log
FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Service roles can insert order audit log" ON order_audit_log;
CREATE POLICY "Service roles can insert order audit log" ON order_audit_log  
FOR INSERT WITH CHECK (auth.role() = 'service_role');