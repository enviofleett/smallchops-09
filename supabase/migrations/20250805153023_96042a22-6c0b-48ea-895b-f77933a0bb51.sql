-- Fix the customer_id mismatch in orders table
UPDATE orders 
SET customer_id = 'db1a3ab2-6df7-4d97-b066-afb5cd7b9e67', updated_at = NOW()
WHERE customer_email = 'chudesyl@gmail.com' 
  AND customer_id = '1468065b-7c20-4139-a047-f88f8eabbc90';