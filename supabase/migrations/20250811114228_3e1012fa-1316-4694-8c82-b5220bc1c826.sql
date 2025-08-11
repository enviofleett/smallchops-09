-- Clean up test data properly handling foreign key constraints

-- 1. First remove order items for test products
DELETE FROM order_items 
WHERE product_id IN (
  SELECT id FROM products 
  WHERE name IN ('E2E Test Smallchops Combo', 'Sylvester Chude')
);

-- 2. Remove order items for orders from test customers
DELETE FROM order_items 
WHERE order_id IN (
  SELECT id FROM orders 
  WHERE customer_email IN ('pam@gmail.com', 'lizzi4200@gmail.com', 'akpanphilip1122@gmail.com')
);

-- 3. Remove orders from test customers
DELETE FROM orders 
WHERE customer_email IN ('pam@gmail.com', 'lizzi4200@gmail.com', 'akpanphilip1122@gmail.com');

-- 4. Now safely remove test products
DELETE FROM products 
WHERE name IN ('E2E Test Smallchops Combo', 'Sylvester Chude');

-- 5. Remove customers with test phone numbers
DELETE FROM customer_accounts 
WHERE phone = '+1234567890';

-- 6. Create production metrics view
CREATE OR REPLACE VIEW production_metrics AS
SELECT 
  (SELECT COUNT(*) FROM products WHERE name NOT LIKE '%test%' AND name NOT LIKE '%Test%') as total_products,
  (SELECT COUNT(*) FROM orders WHERE payment_status = 'paid') as total_paid_orders,
  (SELECT COUNT(DISTINCT customer_email) FROM orders WHERE payment_status = 'paid') as total_paying_customers,
  (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE payment_status = 'paid') as total_revenue;