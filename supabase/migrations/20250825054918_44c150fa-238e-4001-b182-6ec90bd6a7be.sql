-- Enhance delivery management system with driver performance tracking

-- Create driver performance analytics table
CREATE TABLE IF NOT EXISTS driver_performance_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  orders_completed INTEGER NOT NULL DEFAULT 0,
  orders_failed INTEGER NOT NULL DEFAULT 0,
  total_delivery_fees NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_distance_km NUMERIC(8,2) NOT NULL DEFAULT 0,
  average_delivery_time_minutes NUMERIC(6,2) NOT NULL DEFAULT 0,
  customer_ratings_average NUMERIC(3,2) DEFAULT NULL,
  total_customer_ratings INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(driver_id, week_start_date)
);

-- Enable RLS on driver_performance_analytics
ALTER TABLE driver_performance_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for driver_performance_analytics
CREATE POLICY "Admins can manage driver performance analytics"
  ON driver_performance_analytics FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create order status change audit table
CREATE TABLE IF NOT EXISTS order_status_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on order_status_changes
ALTER TABLE order_status_changes ENABLE ROW LEVEL SECURITY;

-- RLS policies for order_status_changes
CREATE POLICY "Admins can view order status changes"
  ON order_status_changes FOR SELECT
  USING (is_admin());

CREATE POLICY "System can insert order status changes"
  ON order_status_changes FOR INSERT
  WITH CHECK (true);

-- Create delivery assignments table for tracking driver assignments
CREATE TABLE IF NOT EXISTS delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  estimated_delivery_time TIMESTAMP WITH TIME ZONE,
  actual_delivery_time TIMESTAMP WITH TIME ZONE,
  delivery_notes TEXT,
  customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'in_progress', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

-- Enable RLS on delivery_assignments
ALTER TABLE delivery_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for delivery_assignments
CREATE POLICY "Admins can manage delivery assignments"
  ON delivery_assignments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_driver_performance_week ON driver_performance_analytics(driver_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_order_status_changes_order_id ON order_status_changes(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_driver_date ON delivery_assignments(driver_id, assigned_at);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order_status ON delivery_assignments(order_id, status);

-- Function to log order status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_changes (
      order_id,
      previous_status,
      new_status,
      changed_by,
      notes,
      metadata
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      CASE 
        WHEN NEW.status = 'ready' THEN 'Order ready for delivery/pickup'
        WHEN NEW.status = 'out_for_delivery' THEN 'Order dispatched for delivery'
        WHEN NEW.status = 'delivered' THEN 'Order successfully delivered'
        ELSE 'Status updated'
      END,
      jsonb_build_object(
        'order_type', NEW.order_type,
        'previous_status', OLD.status,
        'new_status', NEW.status,
        'timestamp', NOW()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for order status changes
DROP TRIGGER IF EXISTS trigger_log_order_status_change ON orders;
CREATE TRIGGER trigger_log_order_status_change
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- Function to calculate driver weekly performance
CREATE OR REPLACE FUNCTION calculate_driver_weekly_performance(
  p_driver_id UUID,
  p_week_start DATE
)
RETURNS TABLE(
  orders_completed INTEGER,
  orders_failed INTEGER,
  total_fees NUMERIC,
  avg_delivery_time NUMERIC,
  avg_rating NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(CASE WHEN da.status = 'completed' THEN 1 END)::INTEGER as orders_completed,
    COUNT(CASE WHEN da.status = 'failed' THEN 1 END)::INTEGER as orders_failed,
    COALESCE(SUM(CASE WHEN da.status = 'completed' THEN o.total_amount * 0.1 ELSE 0 END), 0)::NUMERIC as total_fees,
    COALESCE(AVG(CASE 
      WHEN da.status = 'completed' AND da.started_at IS NOT NULL AND da.completed_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (da.completed_at - da.started_at))/60 
      ELSE NULL 
    END), 0)::NUMERIC as avg_delivery_time,
    COALESCE(AVG(da.customer_rating::NUMERIC), 0)::NUMERIC as avg_rating
  FROM delivery_assignments da
  JOIN orders o ON da.order_id = o.id
  WHERE da.driver_id = p_driver_id
    AND da.assigned_at >= p_week_start
    AND da.assigned_at < p_week_start + INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign driver to ready order
CREATE OR REPLACE FUNCTION assign_driver_to_order(
  p_order_id UUID,
  p_driver_id UUID,
  p_estimated_delivery_time TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_order_record RECORD;
  v_driver_record RECORD;
  v_assignment_id UUID;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Validate order exists and is ready
  SELECT * INTO v_order_record
  FROM orders
  WHERE id = p_order_id AND status = 'ready';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found or not ready');
  END IF;

  -- Validate driver exists and is active
  SELECT * INTO v_driver_record
  FROM drivers
  WHERE id = p_driver_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Driver not found or inactive');
  END IF;

  -- Check if order already has an assignment
  IF EXISTS (SELECT 1 FROM delivery_assignments WHERE order_id = p_order_id) THEN
    RETURN json_build_object('success', false, 'error', 'Order already assigned');
  END IF;

  -- Create delivery assignment
  INSERT INTO delivery_assignments (
    order_id,
    driver_id,
    assigned_by,
    estimated_delivery_time,
    status
  ) VALUES (
    p_order_id,
    p_driver_id,
    auth.uid(),
    COALESCE(p_estimated_delivery_time, NOW() + INTERVAL '1 hour'),
    'assigned'
  ) RETURNING id INTO v_assignment_id;

  -- Update order with assigned driver
  UPDATE orders 
  SET assigned_rider_id = p_driver_id,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Log the assignment
  INSERT INTO audit_logs (
    action, category, message, user_id, entity_id, new_values
  ) VALUES (
    'driver_assigned',
    'Delivery Management',
    'Driver assigned to order: ' || v_order_record.order_number,
    auth.uid(),
    p_order_id,
    json_build_object(
      'driver_id', p_driver_id,
      'driver_name', v_driver_record.name,
      'assignment_id', v_assignment_id
    )
  );

  RETURN json_build_object(
    'success', true,
    'assignment_id', v_assignment_id,
    'message', 'Driver assigned successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update delivery status
CREATE OR REPLACE FUNCTION update_delivery_status(
  p_assignment_id UUID,
  p_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_assignment RECORD;
  v_order_status TEXT;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Validate assignment exists
  SELECT da.*, o.order_number, o.status as order_status
  INTO v_assignment
  FROM delivery_assignments da
  JOIN orders o ON da.order_id = o.id
  WHERE da.id = p_assignment_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Assignment not found');
  END IF;

  -- Determine order status based on delivery status
  v_order_status := CASE 
    WHEN p_status = 'in_progress' THEN 'out_for_delivery'
    WHEN p_status = 'completed' THEN 'delivered'
    WHEN p_status = 'failed' THEN 'cancelled'
    ELSE v_assignment.order_status
  END;

  -- Update delivery assignment
  UPDATE delivery_assignments
  SET 
    status = p_status,
    delivery_notes = COALESCE(p_notes, delivery_notes),
    accepted_at = CASE WHEN p_status = 'accepted' AND accepted_at IS NULL THEN NOW() ELSE accepted_at END,
    started_at = CASE WHEN p_status = 'in_progress' AND started_at IS NULL THEN NOW() ELSE started_at END,
    completed_at = CASE WHEN p_status = 'completed' AND completed_at IS NULL THEN NOW() ELSE completed_at END,
    failed_at = CASE WHEN p_status = 'failed' AND failed_at IS NULL THEN NOW() ELSE failed_at END,
    failure_reason = CASE WHEN p_status = 'failed' THEN COALESCE(p_notes, failure_reason) ELSE failure_reason END,
    updated_at = NOW()
  WHERE id = p_assignment_id;

  -- Update order status if needed
  IF v_order_status != v_assignment.order_status THEN
    UPDATE orders
    SET status = v_order_status::order_status,
        updated_at = NOW()
    WHERE id = v_assignment.order_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Delivery status updated successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set up updated_at trigger for new tables
CREATE TRIGGER set_updated_at_delivery_assignments
  BEFORE UPDATE ON delivery_assignments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

CREATE TRIGGER set_updated_at_driver_performance
  BEFORE UPDATE ON driver_performance_analytics
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();