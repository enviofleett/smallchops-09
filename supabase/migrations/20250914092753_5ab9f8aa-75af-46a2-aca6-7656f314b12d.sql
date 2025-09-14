-- Update all discontinued products to active status to ensure full storefront visibility
UPDATE products 
SET status = 'active', updated_at = NOW() 
WHERE status = 'discontinued';