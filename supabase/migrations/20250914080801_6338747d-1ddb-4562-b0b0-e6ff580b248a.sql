-- Remove promotion-related tables and columns
DROP TABLE IF EXISTS promotions CASCADE;
DROP TABLE IF EXISTS promotion_usage CASCADE;
DROP TABLE IF EXISTS promotion_analytics CASCADE;
DROP TABLE IF EXISTS promotion_usage_audit CASCADE;
DROP TABLE IF EXISTS bogo_allocations CASCADE;

-- Remove promotion-related columns from products table
ALTER TABLE products DROP COLUMN IF EXISTS is_promotional;

-- Remove promotion-related columns from customer preferences
ALTER TABLE customer_favorites DROP COLUMN IF EXISTS promotion_alerts;

-- Drop promotion-related edge functions (will be handled separately)
-- Clean up any promotion-related triggers
DROP TRIGGER IF EXISTS validate_promotion_data_trigger ON promotions;
DROP TRIGGER IF EXISTS validate_simplified_promotion_data_trigger ON promotions;

-- Remove promotion-related functions
DROP FUNCTION IF EXISTS validate_promotion_data() CASCADE;
DROP FUNCTION IF EXISTS validate_simplified_promotion_data() CASCADE;