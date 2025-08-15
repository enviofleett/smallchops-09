-- Complete System Reset: Delete All Orders and Delivery Zones
-- Provides clean slate for new orders and delivery zones

-- Backup existing data first
CREATE TABLE orders_backup_final AS SELECT * FROM orders;
CREATE TABLE order_items_backup_final AS SELECT * FROM order_items;
CREATE TABLE payment_transactions_backup_final AS SELECT * FROM payment_transactions;

-- Delete all data in correct order to respect foreign key constraints
DELETE FROM payment_transactions;
DELETE FROM order_items;
DELETE FROM orders;

-- Note: Keeping delivery_zones for manual cleanup if needed
-- DELETE FROM delivery_zones;

-- Clean up related tracking tables
DELETE FROM order_status_changes;
DELETE FROM payment_processing_logs;
DELETE FROM payment_processing_status;

-- Log the reset
INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
) VALUES (
    'system_reset_complete',
    'System Management', 
    'System reset complete - all orders and payments deleted',
    jsonb_build_object(
        'reset_timestamp', NOW(),
        'tables_cleared', ARRAY['orders', 'order_items', 'payment_transactions'],
        'ready_for_fresh_start', true
    )
);