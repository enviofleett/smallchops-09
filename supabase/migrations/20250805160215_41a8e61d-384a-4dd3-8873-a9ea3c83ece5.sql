-- Create a function to link orders to customer accounts after checkout
CREATE OR REPLACE FUNCTION public.link_order_to_customer_account(p_order_id uuid, p_customer_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_account_id uuid;
BEGIN
  -- Find customer account by email
  SELECT ca.id INTO v_customer_account_id
  FROM public.customer_accounts ca
  JOIN auth.users u ON ca.user_id = u.id
  WHERE u.email = p_customer_email;
  
  -- If customer account found, update the order
  IF v_customer_account_id IS NOT NULL THEN
    UPDATE public.orders
    SET customer_id = v_customer_account_id,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Log the linking
    INSERT INTO public.audit_logs (action, category, message, new_values)
    VALUES (
      'order_customer_linked',
      'Order Management',
      'Linked order to customer account',
      jsonb_build_object(
        'order_id', p_order_id,
        'customer_email', p_customer_email,
        'customer_account_id', v_customer_account_id
      )
    );
  END IF;
END;
$$;

-- Update existing orders to link them to customer accounts where possible
WITH customer_links AS (
  SELECT 
    o.id as order_id,
    ca.id as customer_account_id
  FROM public.orders o
  JOIN auth.users u ON o.customer_email = u.email
  JOIN public.customer_accounts ca ON ca.user_id = u.id
  WHERE o.customer_id IS NULL
)
UPDATE public.orders 
SET customer_id = customer_links.customer_account_id,
    updated_at = NOW()
FROM customer_links
WHERE orders.id = customer_links.order_id;