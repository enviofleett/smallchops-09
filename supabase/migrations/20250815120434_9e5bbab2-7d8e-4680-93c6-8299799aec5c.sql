-- Complete System Reset: Delete All Delivery Zones and Orders (Corrected)
-- This will provide a clean slate for new delivery zones and orders

-- Phase 1: Create backup tables for recovery (optional safety measure)
CREATE TABLE IF NOT EXISTS delivery_zones_backup_reset AS SELECT * FROM delivery_zones;
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

-- Delete delivery zones (root dependency)
DELETE FROM delivery_zones;

-- Phase 3: Clean up related tables and logs
DELETE FROM order_status_changes;
DELETE FROM order_modifications;
DELETE FROM payment_processing_logs;
DELETE FROM payment_processing_status;
DELETE FROM order_assignments;
DELETE FROM delivery_routes;
DELETE FROM route_order_assignments;
DELETE FROM delivery_analytics;
DELETE FROM driver_delivery_analytics;
DELETE FROM zone_delivery_analytics;
DELETE FROM delivery_performance_metrics;
DELETE FROM order_delivery_schedule;

-- Phase 4: Clean up audit logs related to orders and delivery
DELETE FROM audit_logs WHERE category IN ('Order Management', 'Delivery Management', 'Payment Processing');

-- Phase 5: Verification - Log successful reset
INSERT INTO audit_logs (
    action,
    category, 
    message,
    new_values
) VALUES (
    'complete_system_reset_success',
    'System Management',
    'Complete system reset executed successfully - all delivery zones and orders deleted',
    jsonb_build_object(
        'reset_timestamp', NOW(),
        'tables_cleared', ARRAY[
            'delivery_zones', 'orders', 'order_items', 'payment_transactions',
            'order_status_changes', 'order_modifications', 'payment_processing_logs',
            'payment_processing_status', 'order_assignments', 'delivery_routes',
            'route_order_assignments', 'delivery_analytics', 'driver_delivery_analytics',
            'zone_delivery_analytics', 'delivery_performance_metrics', 'order_delivery_schedule'
        ],
        'backup_tables_created', ARRAY[
            'delivery_zones_backup_reset', 'orders_backup_reset', 
            'order_items_backup_reset', 'payment_transactions_backup_reset'
        ],
        'reason', 'Clean slate for new delivery zones and orders without conflicts',
        'ready_for_new_orders', true,
        'payment_reference_generation_preserved', true
    )
);