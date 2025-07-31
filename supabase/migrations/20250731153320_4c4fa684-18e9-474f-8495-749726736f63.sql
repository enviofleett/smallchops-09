-- Phase 1: Clean up demo data and add admin delete functionality

-- First, let's clean up the demo customers that were bulk inserted
-- These all have the same timestamp: 2025-07-23 19:28:18.122361+00
DELETE FROM customers 
WHERE created_at = '2025-07-23 19:28:18.122361+00'::timestamptz;

-- Add delete customer function for admin use
CREATE OR REPLACE FUNCTION public.delete_customer_cascade(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_record RECORD;
  v_deleted_orders INTEGER := 0;
  v_deleted_favorites INTEGER := 0;
  v_deleted_reviews INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Check if customer exists and get info
  SELECT * INTO v_customer_record FROM customers WHERE id = p_customer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer with ID % not found', p_customer_id;
  END IF;

  -- Log the deletion attempt
  INSERT INTO audit_logs (
    user_id,
    action,
    category,
    entity_type,
    entity_id,
    message,
    old_values
  ) VALUES (
    auth.uid(),
    'DELETE_CUSTOMER',
    'Customer Management',
    'customer',
    p_customer_id,
    'Admin deleted customer: ' || v_customer_record.name,
    to_jsonb(v_customer_record)
  );

  -- Delete related data in correct order (respecting foreign keys)
  
  -- Delete customer favorites
  DELETE FROM customer_favorites WHERE customer_id = p_customer_id;
  GET DIAGNOSTICS v_deleted_favorites = ROW_COUNT;
  
  -- Delete customer notification preferences
  DELETE FROM customer_notification_preferences WHERE customer_id = p_customer_id;
  
  -- Delete customer notification channels
  DELETE FROM customer_notification_channels WHERE customer_id = p_customer_id;
  
  -- Delete product reviews by this customer
  DELETE FROM product_reviews 
  WHERE customer_id = p_customer_id;
  GET DIAGNOSTICS v_deleted_reviews = ROW_COUNT;
  
  -- Delete orders (this will cascade to order_items via foreign key)
  DELETE FROM orders WHERE customer_id = p_customer_id;
  GET DIAGNOSTICS v_deleted_orders = ROW_COUNT;
  
  -- Delete customer accounts if they exist
  DELETE FROM customer_accounts 
  WHERE id = p_customer_id;
  
  -- Delete the main customer record
  DELETE FROM customers WHERE id = p_customer_id;
  
  -- Prepare result
  v_result := jsonb_build_object(
    'success', true,
    'customer_id', p_customer_id,
    'customer_name', v_customer_record.name,
    'deleted_orders', v_deleted_orders,
    'deleted_favorites', v_deleted_favorites,
    'deleted_reviews', v_deleted_reviews,
    'message', 'Customer and all related data deleted successfully'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO audit_logs (
      user_id,
      action,
      category,
      entity_type,
      entity_id,
      message,
      old_values
    ) VALUES (
      auth.uid(),
      'DELETE_CUSTOMER_ERROR',
      'Customer Management',
      'customer',
      p_customer_id,
      'Error deleting customer: ' || SQLERRM,
      jsonb_build_object('error', SQLERRM)
    );
    
    RAISE;
END;
$$;

-- Grant execute permission to admins
GRANT EXECUTE ON FUNCTION public.delete_customer_cascade(uuid) TO authenticated;

-- Add RLS policy for customer deletion (admin only)
CREATE POLICY "Admins can delete customers via function" 
ON customers 
FOR DELETE 
TO authenticated 
USING (is_admin());

-- Update existing RLS policies to ensure consistency
DROP POLICY IF EXISTS "Staff and above can manage customers" ON customers;

CREATE POLICY "Staff can view all customers" 
ON customers 
FOR SELECT 
TO authenticated 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text]));

CREATE POLICY "Staff can insert customers" 
ON customers 
FOR INSERT 
TO authenticated 
WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text]));

CREATE POLICY "Staff can update customers" 
ON customers 
FOR UPDATE 
TO authenticated 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text]))
WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text]));

-- Only admins can delete customers directly (or via the function)
CREATE POLICY "Only admins can delete customers" 
ON customers 
FOR DELETE 
TO authenticated 
USING (is_admin());