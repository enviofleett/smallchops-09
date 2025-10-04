-- Production-ready MOQ enforcement: Data integrity and constraints

-- 1. Ensure all products have valid MOQ (default to 1 for existing products with NULL)
UPDATE products 
SET minimum_order_quantity = 1 
WHERE minimum_order_quantity IS NULL;

-- 2. Add check constraint to ensure MOQ is always >= 1
ALTER TABLE products 
ADD CONSTRAINT products_moq_minimum_check 
CHECK (minimum_order_quantity >= 1);

-- 3. Add NOT NULL constraint after setting defaults
ALTER TABLE products 
ALTER COLUMN minimum_order_quantity SET NOT NULL;

-- 4. Add default value for future inserts
ALTER TABLE products 
ALTER COLUMN minimum_order_quantity SET DEFAULT 1;

-- 5. Add index on minimum_order_quantity for faster MOQ validation queries
CREATE INDEX IF NOT EXISTS idx_products_moq 
ON products(minimum_order_quantity) 
WHERE minimum_order_quantity > 1;

-- 6. Add comment for documentation
COMMENT ON COLUMN products.minimum_order_quantity IS 'Minimum order quantity required for this product. Must be >= 1. Default is 1.';
