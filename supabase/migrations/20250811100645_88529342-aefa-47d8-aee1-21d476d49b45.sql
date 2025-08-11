-- Fix the emergency backfill function without delivery_notes column
CREATE OR REPLACE FUNCTION emergency_backfill_broken_orders()
RETURNS JSON AS $$
DECLARE
  v_fixed_count INTEGER := 0;
  v_order_record RECORD;
BEGIN
  FOR v_order_record IN
    SELECT DISTINCT o.id, o.payment_reference, o.total_amount
    FROM orders o
    WHERE 
      o.status = 'pending' 
      AND o.payment_status = 'pending'
      AND o.created_at > NOW() - INTERVAL '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM payment_transactions pt 
        WHERE pt.order_id = o.id OR pt.provider_reference = o.payment_reference
      )
  LOOP
    -- Mark as cancelled due to missing payment records
    UPDATE orders 
    SET 
      status = 'cancelled',
      payment_status = 'failed',
      updated_at = NOW()
    WHERE id = v_order_record.id;
    
    -- Log the emergency fix in audit_logs
    INSERT INTO audit_logs (
      action,
      category,
      message,
      new_values
    ) VALUES (
      'emergency_order_cancellation',
      'Payment Recovery',
      'Order cancelled due to missing payment transaction record',
      jsonb_build_object(
        'order_id', v_order_record.id,
        'payment_reference', v_order_record.payment_reference,
        'total_amount', v_order_record.total_amount
      )
    );
    
    v_fixed_count := v_fixed_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'orders_marked_for_review', v_fixed_count,
    'message', 'Orders marked as cancelled due to missing payment records'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;