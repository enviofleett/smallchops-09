-- Update products with missing images to use a placeholder
UPDATE products 
SET image_url = '/placeholder.svg'
WHERE image_url IS NULL OR image_url = '';

-- Add any missing indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_status_name ON products(status, name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_status ON products(category_id, status);