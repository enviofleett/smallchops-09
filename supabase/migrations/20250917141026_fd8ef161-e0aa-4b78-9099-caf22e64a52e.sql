-- Create the missing update_order_status RPC function that handles enum casting properly
CREATE OR REPLACE FUNCTION update_order_status(
  order_id UUID,
  new_order_status TEXT,
  new_payment_status TEXT,
  payment_data JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
  valid_order_statuses TEXT[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
  valid_payment_statuses TEXT[] := ARRAY['pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded', 'partially_paid'];
BEGIN
  -- Validate inputs and reject null/empty values
  IF order_id IS NULL THEN
    RAISE EXCEPTION 'Order ID cannot be null';
  END IF;
  
  IF new_order_status IS NULL OR new_order_status = '' OR new_order_status = 'null' THEN
    RAISE EXCEPTION 'Order status cannot be null or empty';
  END IF;
  
  IF new_payment_status IS NULL OR new_payment_status = '' OR new_payment_status = 'null' THEN
    RAISE EXCEPTION 'Payment status cannot be null or empty';
  END IF;
  
  -- Validate enum values
  IF NOT (new_order_status = ANY(valid_order_statuses)) THEN
    RAISE EXCEPTION 'Invalid order status: %. Valid values: %', new_order_status, array_to_string(valid_order_statuses, ', ');
  END IF;
  
  IF NOT (new_payment_status = ANY(valid_payment_statuses)) THEN
    RAISE EXCEPTION 'Invalid payment status: %. Valid values: %', new_payment_status, array_to_string(valid_payment_statuses, ', ');
  END IF;
  
  -- Update with explicit enum casting
  UPDATE orders SET
    status = new_order_status::order_status,
    payment_status = new_payment_status::payment_status,
    payment_data = COALESCE(payment_data, '{}'::jsonb),
    payment_verified_at = NOW(),
    updated_at = NOW()
  WHERE id = order_id;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found with ID: %', order_id;
  END IF;
  
  -- Log successful update
  INSERT INTO audit_logs (action, category, message, entity_id, new_values)
  VALUES (
    'order_status_updated_via_rpc',
    'Payment Processing',
    'Order status updated via RPC function',
    order_id,
    jsonb_build_object(
      'order_status', new_order_status,
      'payment_status', new_payment_status,
      'timestamp', NOW()
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO audit_logs (action, category, message, entity_id, new_values)
  VALUES (
    'order_status_update_failed_rpc',
    'Payment Processing Error',
    'Order status update failed: ' || SQLERRM,
    order_id,
    jsonb_build_object(
      'error', SQLERRM,
      'order_status', new_order_status,
      'payment_status', new_payment_status,
      'timestamp', NOW()
    )
  );
  
  -- Re-raise the exception
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;