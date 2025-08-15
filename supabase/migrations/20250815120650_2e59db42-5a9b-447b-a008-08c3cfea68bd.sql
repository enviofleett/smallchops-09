-- System Reset: Delete All Order and Payment Data
-- Provides clean slate for new orders and payments

-- First check what exists and create backups
DO $$
BEGIN
    -- Backup payment_transactions if it exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_transactions') THEN
        EXECUTE 'CREATE TABLE payment_transactions_backup_reset AS SELECT * FROM payment_transactions';
    END IF;
    
    -- Backup order_items if it exists and has data  
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items') THEN
        EXECUTE 'CREATE TABLE order_items_backup_reset AS SELECT * FROM order_items';
    END IF;
    
    -- Backup orders if it exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        EXECUTE 'CREATE TABLE orders_backup_reset AS SELECT * FROM orders';
    END IF;
END $$;

-- Delete all data in proper order
DELETE FROM payment_transactions;
DELETE FROM order_items;  
DELETE FROM orders;

-- Clean delivery zones if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_zones') THEN
        EXECUTE 'DELETE FROM delivery_zones';
    END IF;
END $$;

-- Log successful reset
INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
) VALUES (
    'complete_system_reset_success',
    'System Management',
    'System reset completed - all orders, payments and delivery zones cleared',
    jsonb_build_object(
        'timestamp', NOW(),
        'tables_reset', ARRAY['orders', 'order_items', 'payment_transactions', 'delivery_zones'],
        'ready_for_new_data', true
    )
);