-- Final System Reset: Clear Existing Order Data Only
-- This will reset orders and payments, creating clean slate

-- Create backups of existing data
CREATE TABLE payment_transactions_backup_final AS SELECT * FROM payment_transactions;
CREATE TABLE order_items_backup_final AS SELECT * FROM order_items;
CREATE TABLE orders_backup_final AS SELECT * FROM orders;

-- Clear all order and payment data
DELETE FROM payment_transactions;
DELETE FROM order_items;
DELETE FROM orders;

-- Verify empty state
SELECT 
  'Reset Complete' as status,
  (SELECT COUNT(*) FROM orders) as orders_remaining,
  (SELECT COUNT(*) FROM order_items) as order_items_remaining,
  (SELECT COUNT(*) FROM payment_transactions) as transactions_remaining;

-- Log the successful reset
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'system_reset_final',
  'System Management',
  'System successfully reset - all orders and payments cleared',
  jsonb_build_object(
    'reset_timestamp', NOW(),
    'tables_cleared', ARRAY['orders', 'order_items', 'payment_transactions'],
    'backup_tables_created', ARRAY['orders_backup_final', 'order_items_backup_final', 'payment_transactions_backup_final'],
    'system_ready', true,
    'can_create_new_orders', true
  )
);