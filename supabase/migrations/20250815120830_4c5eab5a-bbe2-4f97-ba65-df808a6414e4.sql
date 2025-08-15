-- System Reset: Clear All Order and Payment Data
-- This provides a completely clean slate

-- Backup data before deletion
CREATE TABLE orders_backup_reset AS SELECT * FROM orders;
CREATE TABLE order_items_backup_reset AS SELECT * FROM order_items;
CREATE TABLE payment_transactions_backup_reset AS SELECT * FROM payment_transactions;

-- Clear all data in proper order
DELETE FROM payment_transactions;
DELETE FROM order_items;
DELETE FROM orders;

-- Log successful reset
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'complete_system_reset_success',
  'System Management',
  'System reset completed successfully - all orders and payments cleared',
  jsonb_build_object(
    'reset_timestamp', NOW(),
    'tables_reset', ARRAY['orders', 'order_items', 'payment_transactions'],
    'backup_tables', ARRAY['orders_backup_reset', 'order_items_backup_reset', 'payment_transactions_backup_reset'],
    'system_ready_for_new_orders', true,
    'payment_reference_generation_intact', true
  )
);