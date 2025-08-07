-- Create a virtual bundle placeholder product for custom bundles
INSERT INTO products (
  id,
  name,
  description,
  price,
  stock_quantity,
  status,
  category_id,
  sku
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Custom Bundle Item (Virtual)',
  'Virtual product representing custom bundle items',
  0,
  999999,
  'active',
  (SELECT id FROM categories LIMIT 1), -- Use first available category
  'VIRTUAL-BUNDLE-001'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();