-- Clean up duplicate delivery schedules (keep the earliest one)
DELETE FROM order_delivery_schedule 
WHERE id NOT IN (
  SELECT DISTINCT ON (order_id) id 
  FROM order_delivery_schedule 
  ORDER BY order_id, created_at ASC
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE order_delivery_schedule 
ADD CONSTRAINT unique_order_delivery_schedule 
UNIQUE (order_id);