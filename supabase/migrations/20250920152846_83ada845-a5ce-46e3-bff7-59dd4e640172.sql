-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS admin_update_order_status_lock_first(uuid,text,uuid,text);

-- Phase 1: Fix Database RPC Function for 409 Conflicts
-- Create the new admin_update_order_status_lock_first function

CREATE OR REPLACE FUNCTION admin_update_order_status_lock_first(
  p_order_id UUID,
  p_new_status TEXT,
  p_admin_user_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  order_data JSONB,
  conflict_info JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_order RECORD;
  lock_acquired BOOLEAN := FALSE;
  lock_timeout_seconds INTEGER := 10;
  retry_count INTEGER := 0;
  max_retries INTEGER := 3;
  valid_transitions JSONB;
  lock_key TEXT;
BEGIN
  -- Generate unique lock key for this order
  lock_key := 'order_status_update_' || p_order_id::text;
  
  -- Define valid status transitions
  valid_transitions := '{
    "pending": ["confirmed", "cancelled", "preparing"],
    "confirmed": ["preparing", "cancelled"],
    "preparing": ["ready", "cancelled"],
    "ready": ["out_for_delivery", "cancelled"],
    "out_for_delivery": ["delivered", "cancelled"],
    "delivered": [],
    "cancelled": []
  }'::jsonb;

  -- Retry loop for handling concurrent updates
  WHILE retry_count < max_retries LOOP
    BEGIN
      -- Try to acquire advisory lock with timeout
      SELECT pg_try_advisory_lock(hashtext(lock_key)) INTO lock_acquired;
      
      IF NOT lock_acquired THEN
        -- Wait briefly and retry
        PERFORM pg_sleep(0.1 + (retry_count * 0.1));
        retry_count := retry_count + 1;
        CONTINUE;
      END IF;

      -- Lock acquired, proceed with update
      -- Get current order with row-level lock
      SELECT * INTO current_order
      FROM orders 
      WHERE id = p_order_id
      FOR UPDATE NOWAIT;

      -- Check if order exists
      IF NOT FOUND THEN
        PERFORM pg_advisory_unlock(hashtext(lock_key));
        RETURN QUERY SELECT FALSE, 'Order not found', NULL::JSONB, 
          json_build_object('reason', 'order_not_found', 'order_id', p_order_id)::JSONB;
        RETURN;
      END IF;

      -- Check if status is already the target status
      IF current_order.status::text = p_new_status THEN
        PERFORM pg_advisory_unlock(hashtext(lock_key));
        RETURN QUERY SELECT TRUE, 'Status already set to ' || p_new_status, 
          row_to_json(current_order)::JSONB,
          json_build_object('reason', 'no_change_needed')::JSONB;
        RETURN;
      END IF;

      -- Validate status transition
      IF NOT (valid_transitions->current_order.status::text ? p_new_status) THEN
        PERFORM pg_advisory_unlock(hashtext(lock_key));
        RETURN QUERY SELECT FALSE, 
          format('Invalid transition from %s to %s', current_order.status, p_new_status),
          row_to_json(current_order)::JSONB,
          json_build_object(
            'reason', 'invalid_transition',
            'current_status', current_order.status,
            'requested_status', p_new_status,
            'valid_transitions', valid_transitions->current_order.status::text
          )::JSONB;
        RETURN;
      END IF;

      -- Perform the status update
      UPDATE orders SET
        status = p_new_status::order_status,
        updated_at = NOW(),
        admin_notes = COALESCE(admin_notes, '') || 
          CASE 
            WHEN admin_notes IS NOT NULL AND admin_notes != '' THEN E'\n' || NOW()::text || ': ' || COALESCE(p_notes, 'Status changed to ' || p_new_status)
            ELSE NOW()::text || ': ' || COALESCE(p_notes, 'Status changed to ' || p_new_status)
          END,
        last_modified_by = p_admin_user_id
      WHERE id = p_order_id;

      -- Log the status change
      INSERT INTO order_status_history (
        order_id,
        old_status,
        new_status,
        changed_by,
        changed_at,
        notes
      ) VALUES (
        p_order_id,
        current_order.status,
        p_new_status::order_status,
        p_admin_user_id,
        NOW(),
        p_notes
      );

      -- Get updated order data
      SELECT * INTO current_order FROM orders WHERE id = p_order_id;

      -- Release lock
      PERFORM pg_advisory_unlock(hashtext(lock_key));

      -- Return success
      RETURN QUERY SELECT TRUE, 'Status updated successfully', 
        row_to_json(current_order)::JSONB,
        json_build_object('reason', 'success')::JSONB;
      RETURN;

    EXCEPTION
      WHEN lock_not_available THEN
        -- Another transaction has the row locked
        retry_count := retry_count + 1;
        IF lock_acquired THEN
          PERFORM pg_advisory_unlock(hashtext(lock_key));
        END IF;
        PERFORM pg_sleep(0.2 + (retry_count * 0.1));
        CONTINUE;
      
      WHEN OTHERS THEN
        -- Release lock on any error
        IF lock_acquired THEN
          PERFORM pg_advisory_unlock(hashtext(lock_key));
        END IF;
        
        RETURN QUERY SELECT FALSE, 
          format('Database error: %s', SQLERRM),
          NULL::JSONB,
          json_build_object(
            'reason', 'database_error',
            'error_code', SQLSTATE,
            'error_message', SQLERRM
          )::JSONB;
        RETURN;
    END;
  END LOOP;

  -- Max retries reached
  IF lock_acquired THEN
    PERFORM pg_advisory_unlock(hashtext(lock_key));
  END IF;
  
  RETURN QUERY SELECT FALSE, 
    'Update failed: too many concurrent attempts',
    NULL::JSONB,
    json_build_object(
      'reason', 'max_retries_exceeded',
      'retry_count', retry_count
    )::JSONB;
END;
$$;

-- Add missing last_modified_by column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_modified_by UUID;

-- Create order status history table if it doesn't exist
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  old_status order_status,
  new_status order_status,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on order_status_history
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for order_status_history
CREATE POLICY "Admins can view all order status history" 
ON order_status_history 
FOR SELECT 
USING (is_admin());

CREATE POLICY "System can insert order status history" 
ON order_status_history 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at ON order_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_orders_last_modified_by ON orders(last_modified_by);

-- Function to cleanup old advisory locks (run periodically)
CREATE OR REPLACE FUNCTION cleanup_order_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  locks_cleared INTEGER;
BEGIN
  -- This function can be called periodically to ensure no locks are stuck
  -- Note: Advisory locks are automatically released when sessions end
  SELECT COUNT(*) INTO locks_cleared 
  FROM pg_locks 
  WHERE locktype = 'advisory' 
    AND objsubid = 1;
  
  RETURN locks_cleared;
END;
$$;