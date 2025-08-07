-- Create a virtual bundle placeholder product for custom bundles
INSERT INTO products (
  id,
  name,
  slug,
  description,
  price,
  category_id,
  is_active,
  stock_quantity,
  is_virtual
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Custom Bundle Item (Virtual)',
  'custom-bundle-item-virtual',
  'Virtual product representing custom bundle items',
  0,
  (SELECT id FROM categories LIMIT 1), -- Use first available category
  true,
  999999,
  true
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();