-- Add MOQ (Minimum Order Quantity) column to products table
ALTER TABLE products 
ADD COLUMN minimum_order_quantity INTEGER DEFAULT 1 CHECK (minimum_order_quantity > 0);

-- Add comment for documentation
COMMENT ON COLUMN products.minimum_order_quantity IS 'Minimum quantity required to purchase this product';

-- Update existing products to have default MOQ of 1
UPDATE products 
SET minimum_order_quantity = 1 
WHERE minimum_order_quantity IS NULL;