-- Complete System Reset: Delete All Delivery Zones and Orders
-- This will provide a clean slate for new delivery zones and orders

-- Phase 1: Create backup tables for recovery (optional safety measure)
CREATE TABLE IF NOT EXISTS delivery_zones_backup_reset AS SELECT * FROM delivery_zones;
CREATE TABLE IF NOT EXISTS delivery_fees_backup_reset AS SELECT * FROM delivery_fees;
CREATE TABLE IF NOT EXISTS orders_backup_reset AS SELECT * FROM orders;
CREATE TABLE IF NOT EXISTS order_items_backup_reset AS SELECT * FROM order_items;
CREATE TABLE IF NOT EXISTS payment_transactions_backup_reset AS SELECT * FROM payment_transactions;

-- Phase 2: Clean deletion in proper order (respecting foreign key constraints)

-- Delete payment transactions first (no dependencies)
DELETE FROM payment_transactions;

-- Delete order items (depends on orders)
DELETE FROM order_items;

-- Delete orders (depends on delivery_zones, customers)
DELETE FROM orders;

-- Delete delivery fees (depends on delivery_zones)
DELETE FROM delivery_fees;

-- Delete delivery zones (root dependency)
DELETE FROM delivery_zones;

-- Phase 3: Clean up related audit logs and status tables
DELETE FROM audit_logs WHERE category IN ('Order Management', 'Delivery Management', 'Payment Processing');
DELETE FROM payment_processing_logs;
DELETE FROM payment_processing_status;
DELETE FROM order_status_changes;
DELETE FROM order_modifications;

-- Phase 4: Reset any auto-increment sequences or counters
-- Note: UUID sequences don't need reset, but if there were any integer sequences they would be reset here

-- Phase 5: Verification queries (commented out, but can be used to verify)
-- SELECT COUNT(*) as delivery_zones_count FROM delivery_zones; -- Should be 0
-- SELECT COUNT(*) as delivery_fees_count FROM delivery_fees; -- Should be 0  
-- SELECT COUNT(*) as orders_count FROM orders; -- Should be 0
-- SELECT COUNT(*) as order_items_count FROM order_items; -- Should be 0
-- SELECT COUNT(*) as payment_transactions_count FROM payment_transactions; -- Should be 0

-- Log the system reset
INSERT INTO audit_logs (
    action,
    category, 
    message,
    new_values
) VALUES (
    'complete_system_reset',
    'System Management',
    'Complete system reset executed - all delivery zones and orders deleted',
    jsonb_build_object(
        'reset_timestamp', NOW(),
        'tables_cleared', ARRAY['delivery_zones', 'delivery_fees', 'orders', 'order_items', 'payment_transactions'],
        'backup_tables_created', ARRAY['delivery_zones_backup_reset', 'delivery_fees_backup_reset', 'orders_backup_reset', 'order_items_backup_reset', 'payment_transactions_backup_reset'],
        'reason', 'Clean slate for new delivery zones and orders without conflicts'
    )
);