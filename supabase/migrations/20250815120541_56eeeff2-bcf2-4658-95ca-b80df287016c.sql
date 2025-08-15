-- Simple System Reset: Delete Core Order and Payment Data
-- This provides a clean slate for new orders

-- Backup existing data
CREATE TABLE orders_backup_clean AS SELECT * FROM orders;
CREATE TABLE order_items_backup_clean AS SELECT * FROM order_items; 
CREATE TABLE payment_transactions_backup_clean AS SELECT * FROM payment_transactions;

-- Delete all order and payment data
DELETE FROM payment_transactions;
DELETE FROM order_items;
DELETE FROM orders;

-- Verify tables are empty
SELECT 'orders' as table_name, COUNT(*) as remaining_rows FROM orders
UNION ALL
SELECT 'order_items' as table_name, COUNT(*) as remaining_rows FROM order_items
UNION ALL  
SELECT 'payment_transactions' as table_name, COUNT(*) as remaining_rows FROM payment_transactions;