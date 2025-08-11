-- Clean up test data for production readiness

-- 1. Remove customers with test phone numbers
DELETE FROM customer_accounts 
WHERE phone = '+1234567890';

-- 2. Remove obvious test products
DELETE FROM products 
WHERE name IN ('E2E Test Smallchops Combo', 'Sylvester Chude');

-- 3. Remove orders from test customers (with test phone numbers)
DELETE FROM orders 
WHERE customer_email IN (
  SELECT email FROM customer_accounts 
  WHERE phone = '+1234567890'
);

-- 4. Remove orders from deleted test customers
DELETE FROM orders 
WHERE customer_email IN ('pam@gmail.com', 'lizzi4200@gmail.com', 'akpanphilip1122@gmail.com');

-- 5. Update revenue calculation view for production
CREATE OR REPLACE VIEW production_metrics AS
SELECT 
  (SELECT COUNT(*) FROM products WHERE name NOT LIKE '%test%' AND name NOT LIKE '%Test%') as total_products,
  (SELECT COUNT(*) FROM orders WHERE payment_status = 'paid') as total_paid_orders,
  (SELECT COUNT(DISTINCT customer_email) FROM orders WHERE payment_status = 'paid') as total_paying_customers,
  (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE payment_status = 'paid') as total_revenue;

-- 6. Log the cleanup for audit trail
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'production_data_cleanup',
  'Data Management',
  'Cleaned up test data for production readiness',
  jsonb_build_object(
    'cleanup_date', NOW(),
    'removed_test_customers', true,
    'removed_test_products', true,
    'cleaned_test_orders', true
  )
);