-- Create RPC function for order linking stats
CREATE OR REPLACE FUNCTION public.get_order_linking_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
  total_orders INTEGER;
  linked_orders INTEGER;
  unlinked_orders INTEGER;
  linking_percentage NUMERIC;
BEGIN
  -- Get total orders count
  SELECT COUNT(*) INTO total_orders FROM orders;
  
  -- Get linked orders count (orders with customer_id pointing to customer_accounts)
  SELECT COUNT(*) INTO linked_orders 
  FROM orders o 
  INNER JOIN customer_accounts ca ON o.customer_id = ca.id;
  
  -- Calculate unlinked orders
  unlinked_orders := total_orders - linked_orders;
  
  -- Calculate linking percentage
  linking_percentage := CASE 
    WHEN total_orders > 0 THEN (linked_orders::NUMERIC / total_orders * 100)
    ELSE 0 
  END;
  
  RETURN jsonb_build_object(
    'total_orders', total_orders,
    'linked_orders', linked_orders,
    'unlinked_orders', unlinked_orders,
    'linking_percentage', ROUND(linking_percentage, 2),
    'health_status', CASE 
      WHEN linking_percentage >= 90 THEN 'excellent'
      WHEN linking_percentage >= 75 THEN 'good'  
      WHEN linking_percentage >= 50 THEN 'needs_improvement'
      ELSE 'critical'
    END
  );
END;
$$;

-- Run the email processor to clear stuck emails
SELECT process_stuck_emails();