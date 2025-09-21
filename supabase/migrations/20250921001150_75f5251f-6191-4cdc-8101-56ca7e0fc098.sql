-- Phase 1: Simplified Order Management Database Schema
-- Clean, minimal design focused on essential order management

-- Drop old complex tables that cause conflicts
DROP TABLE IF EXISTS order_update_locks CASCADE;
DROP TABLE IF EXISTS request_cache CASCADE;
DROP TABLE IF EXISTS communication_events_collision_log CASCADE;

-- Create simplified orders table with optimistic locking
CREATE TABLE IF NOT EXISTS orders_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  status order_status DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  order_type order_type DEFAULT 'delivery',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  delivery_address JSONB,
  special_instructions TEXT,
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID,
  updated_by_name TEXT,
  version INTEGER DEFAULT 1 -- For optimistic locking
);

-- Enable RLS
ALTER TABLE orders_new ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can manage orders" ON orders_new
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Simple order items table
CREATE TABLE IF NOT EXISTS order_items_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders_new(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE order_items_new ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can manage order items" ON order_items_new
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Delivery scheduling table
CREATE TABLE IF NOT EXISTS order_delivery_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders_new(id) ON DELETE CASCADE,
  delivery_date DATE NOT NULL,
  delivery_time_start TIME,
  delivery_time_end TIME,
  assigned_rider_id UUID,
  assigned_rider_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE order_delivery_schedule ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can manage delivery schedule" ON order_delivery_schedule
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Simple audit log for order changes
CREATE TABLE IF NOT EXISTS order_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  admin_name TEXT,
  old_status order_status,
  new_status order_status,
  notes TEXT,
  action_type TEXT DEFAULT 'status_update',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE order_audit ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view audit logs" ON order_audit
  FOR SELECT USING (is_admin());

CREATE POLICY "System can insert audit logs" ON order_audit
  FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_orders_new_status ON orders_new(status);
CREATE INDEX idx_orders_new_created_at ON orders_new(created_at);
CREATE INDEX idx_orders_new_order_number ON orders_new(order_number);
CREATE INDEX idx_order_items_new_order_id ON order_items_new(order_id);
CREATE INDEX idx_order_audit_order_id ON order_audit(order_id);
CREATE INDEX idx_order_audit_created_at ON order_audit(created_at);

-- Migration function to copy existing data
CREATE OR REPLACE FUNCTION migrate_orders_data()
RETURNS VOID AS $$
BEGIN
  -- Copy orders data
  INSERT INTO orders_new (
    id, order_number, customer_name, customer_email, customer_phone,
    status, payment_status, order_type, total_amount, delivery_address,
    special_instructions, payment_reference, created_at, updated_at
  )
  SELECT 
    id, order_number, customer_name, customer_email, customer_phone,
    status, payment_status, order_type, total_amount, delivery_address,
    special_instructions, payment_reference, created_at, updated_at
  FROM orders
  ON CONFLICT (id) DO NOTHING;

  -- Copy order items data
  INSERT INTO order_items_new (
    id, order_id, product_name, quantity, unit_price, total_price, created_at
  )
  SELECT 
    id, order_id, product_name, quantity, unit_price, total_price, created_at
  FROM order_items
  ON CONFLICT (id) DO NOTHING;

  -- Create delivery schedules from existing data
  INSERT INTO order_delivery_schedule (
    order_id, delivery_date, delivery_time_start, delivery_time_end
  )
  SELECT 
    id,
    COALESCE(delivery_time::date, pickup_time::date, created_at::date),
    COALESCE(delivery_time::time, pickup_time::time, '12:00'::time),
    COALESCE((delivery_time + interval '2 hours')::time, (pickup_time + interval '1 hour')::time, '14:00'::time)
  FROM orders
  WHERE delivery_time IS NOT NULL OR pickup_time IS NOT NULL
  ON CONFLICT DO NOTHING;

END;
$$ LANGUAGE plpgsql;

-- Execute migration
SELECT migrate_orders_data();

-- Create trigger to update version on order changes
CREATE OR REPLACE FUNCTION update_order_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_version
  BEFORE UPDATE ON orders_new
  FOR EACH ROW EXECUTE FUNCTION update_order_version();

-- Create audit trigger
CREATE OR REPLACE FUNCTION audit_order_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO order_audit (
      order_id, admin_id, admin_name, old_status, new_status, action_type
    ) VALUES (
      NEW.id, NEW.updated_by, NEW.updated_by_name, OLD.status, NEW.status, 'status_update'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_order_changes
  AFTER UPDATE ON orders_new
  FOR EACH ROW EXECUTE FUNCTION audit_order_changes();