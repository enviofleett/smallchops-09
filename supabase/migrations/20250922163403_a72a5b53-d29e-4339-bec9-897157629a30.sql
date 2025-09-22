-- First let's examine the create_order_with_items function to fix the is_available column issue
-- and see what columns are actually available in the products table

-- Check current products table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if there's an is_available column or if we should be using status column
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name IN ('is_available', 'status', 'active', 'enabled');