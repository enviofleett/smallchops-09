-- Enhance MOQ system with production-ready constraints and validation

-- Add index for better performance on MOQ queries
CREATE INDEX IF NOT EXISTS idx_products_moq ON products(minimum_order_quantity) WHERE minimum_order_quantity > 1;

-- Add constraint to ensure MOQ is always positive
ALTER TABLE products ADD CONSTRAINT products_moq_positive_check 
  CHECK (minimum_order_quantity IS NULL OR minimum_order_quantity > 0);

-- Create function to validate MOQ for orders
CREATE OR REPLACE FUNCTION validate_order_moq(order_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
  product_row RECORD;
  violations jsonb[] := '{}';
  violation jsonb;
BEGIN
  -- Iterate through each order item
  FOR item IN SELECT * FROM jsonb_array_elements(order_items)
  LOOP
    -- Get product details
    SELECT p.* INTO product_row 
    FROM products p 
    WHERE p.id = (item->>'product_id')::uuid;
    
    IF NOT FOUND THEN
      violations := violations || jsonb_build_object(
        'product_id', item->>'product_id',
        'error', 'Product not found',
        'type', 'not_found'
      );
      CONTINUE;
    END IF;
    
    -- Check MOQ violation
    IF product_row.minimum_order_quantity IS NOT NULL 
       AND (item->>'quantity')::integer < product_row.minimum_order_quantity THEN
      
      violations := violations || jsonb_build_object(
        'product_id', product_row.id,
        'product_name', product_row.name,
        'current_quantity', (item->>'quantity')::integer,
        'minimum_required', product_row.minimum_order_quantity,
        'shortfall', product_row.minimum_order_quantity - (item->>'quantity')::integer,
        'type', 'moq_violation'
      );
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'is_valid', array_length(violations, 1) IS NULL,
    'violations', violations,
    'total_violations', COALESCE(array_length(violations, 1), 0)
  );
END;
$$;

-- Create function to auto-adjust quantities to meet MOQ
CREATE OR REPLACE FUNCTION adjust_quantities_for_moq(order_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
  product_row RECORD;
  adjusted_items jsonb[] := '{}';
  adjusted_item jsonb;
  adjustments_made jsonb[] := '{}';
BEGIN
  -- Iterate through each order item
  FOR item IN SELECT * FROM jsonb_array_elements(order_items)
  LOOP
    -- Get product details
    SELECT p.* INTO product_row 
    FROM products p 
    WHERE p.id = (item->>'product_id')::uuid;
    
    IF NOT FOUND THEN
      -- Keep original item if product not found
      adjusted_items := adjusted_items || item;
      CONTINUE;
    END IF;
    
    -- Check if adjustment needed
    IF product_row.minimum_order_quantity IS NOT NULL 
       AND (item->>'quantity')::integer < product_row.minimum_order_quantity THEN
      
      -- Adjust quantity to meet MOQ
      adjusted_item := item || jsonb_build_object(
        'quantity', product_row.minimum_order_quantity,
        'moq_adjusted', true,
        'original_quantity', (item->>'quantity')::integer
      );
      
      adjustments_made := adjustments_made || jsonb_build_object(
        'product_id', product_row.id,
        'product_name', product_row.name,
        'original_quantity', (item->>'quantity')::integer,
        'adjusted_quantity', product_row.minimum_order_quantity
      );
      
      adjusted_items := adjusted_items || adjusted_item;
    ELSE
      -- No adjustment needed
      adjusted_items := adjusted_items || item;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'adjusted_items', array_to_json(adjusted_items),
    'adjustments_made', array_to_json(adjustments_made),
    'total_adjustments', array_length(adjustments_made, 1)
  );
END;
$$;

-- Create function to calculate MOQ impact on pricing
CREATE OR REPLACE FUNCTION calculate_moq_pricing_impact(order_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
  product_row RECORD;
  original_total numeric := 0;
  adjusted_total numeric := 0;
  moq_impact numeric := 0;
BEGIN
  -- Calculate original and adjusted totals
  FOR item IN SELECT * FROM jsonb_array_elements(order_items)
  LOOP
    SELECT p.* INTO product_row 
    FROM products p 
    WHERE p.id = (item->>'product_id')::uuid;
    
    IF FOUND THEN
      original_total := original_total + (product_row.price * (item->>'quantity')::integer);
      
      -- Calculate adjusted total with MOQ
      IF product_row.minimum_order_quantity IS NOT NULL 
         AND (item->>'quantity')::integer < product_row.minimum_order_quantity THEN
        adjusted_total := adjusted_total + (product_row.price * product_row.minimum_order_quantity);
      ELSE
        adjusted_total := adjusted_total + (product_row.price * (item->>'quantity')::integer);
      END IF;
    END IF;
  END LOOP;
  
  moq_impact := adjusted_total - original_total;
  
  RETURN jsonb_build_object(
    'original_total', original_total,
    'adjusted_total', adjusted_total,
    'moq_impact', moq_impact,
    'impact_percentage', CASE 
      WHEN original_total > 0 THEN (moq_impact / original_total) * 100 
      ELSE 0 
    END
  );
END;
$$;

-- Create trigger to validate MOQ before order insertion
CREATE OR REPLACE FUNCTION trigger_validate_order_moq()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_items jsonb;
  validation_result jsonb;
BEGIN
  -- Skip validation for non-pending orders or if no items
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;
  
  -- Get order items
  SELECT jsonb_agg(
    jsonb_build_object(
      'product_id', oi.product_id,
      'quantity', oi.quantity
    )
  ) INTO order_items
  FROM order_items oi
  WHERE oi.order_id = NEW.id;
  
  -- Skip if no items found
  IF order_items IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Validate MOQ
  validation_result := validate_order_moq(order_items);
  
  -- If there are violations, prevent the order
  IF NOT (validation_result->>'is_valid')::boolean THEN
    RAISE EXCEPTION 'Order violates minimum order quantity requirements: %', 
      validation_result->>'violations'
      USING ERRCODE = 'check_violation';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger to orders table (only if not exists)
DROP TRIGGER IF EXISTS validate_order_moq_trigger ON orders;
CREATE TRIGGER validate_order_moq_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_validate_order_moq();

-- Create audit log for MOQ violations
CREATE TABLE IF NOT EXISTS moq_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id),
  customer_id uuid,
  violation_details jsonb NOT NULL,
  action_taken text, -- 'blocked', 'adjusted', 'override'
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  notes text
);

-- Enable RLS on MOQ audit log
ALTER TABLE moq_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies for MOQ audit log
CREATE POLICY "Admins can view MOQ audit logs" ON moq_audit_log
  FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can manage MOQ audit logs" ON moq_audit_log
  FOR ALL USING (auth.role() = 'service_role');

-- Create function to log MOQ violations
CREATE OR REPLACE FUNCTION log_moq_violation(
  p_order_id uuid,
  p_customer_id uuid,
  p_violations jsonb,
  p_action_taken text DEFAULT 'blocked'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO moq_audit_log (
    order_id,
    customer_id,
    violation_details,
    action_taken
  ) VALUES (
    p_order_id,
    p_customer_id,
    p_violations,
    p_action_taken
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;