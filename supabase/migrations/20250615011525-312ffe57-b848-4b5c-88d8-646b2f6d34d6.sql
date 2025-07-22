
-- Update existing orders with sample customer phone numbers.
-- Assign phone numbers based on a simple sequential pattern for demo purposes.
-- This ensures all orders have customer_phone populated.

-- Example pattern: 0801XXXX123 for unique endings

WITH ordered AS (
  SELECT
    id,
    row_number() OVER (ORDER BY customer_name, order_time, id) as rn
  FROM public.orders
)
UPDATE public.orders
SET customer_phone = '0801' || lpad((1000 + rn)::text, 4, '0')
FROM ordered
WHERE public.orders.id = ordered.id;
