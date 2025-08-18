
-- Enable extension for fast ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- PRODUCTS: filters, ordering, and search
CREATE INDEX IF NOT EXISTS idx_products_category_name ON public.products (category_id, name);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products (status);
CREATE INDEX IF NOT EXISTS idx_products_stock_qty ON public.products (stock_quantity);
-- Partial index for common filter (active + in stock)
CREATE INDEX IF NOT EXISTS idx_products_active_instock_cat ON public.products (category_id, name) WHERE status = 'active' AND stock_quantity > 0;

-- Trigram indexes for search (used by edge function with q)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON public.products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_desc_trgm ON public.products USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON public.products USING gin (sku gin_trgm_ops);

-- PROMOTIONS: active window lookups
CREATE INDEX IF NOT EXISTS idx_promotions_status ON public.promotions (status);
CREATE INDEX IF NOT EXISTS idx_promotions_valid_window ON public.promotions (valid_from, valid_until);

-- CATEGORIES: list ordering and lookups
CREATE INDEX IF NOT EXISTS idx_categories_name ON public.categories (name);

-- ORDERS: key lookups and dashboards
CREATE INDEX IF NOT EXISTS idx_orders_customer_time ON public.orders (customer_id, order_time DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON public.orders (payment_reference);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_unique ON public.orders (order_number);

-- ORDER ITEMS: typical joins
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items (product_id);

-- FAVORITES: uniqueness + fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_favorites_unique ON public.customer_favorites (customer_id, product_id);
CREATE INDEX IF NOT EXISTS idx_customer_favorites_customer ON public.customer_favorites (customer_id);

-- Optional: a lean view used by the public products endpoint/UI
CREATE OR REPLACE VIEW public.public_products_view AS
SELECT
  p.id,
  p.name,
  p.description,
  p.price,
  p.sku,
  p.image_url,
  p.stock_quantity,
  p.status,
  p.features,
  p.is_promotional,
  p.preparation_time,
  p.allergen_info,
  p.category_id,
  c.name AS category_name
FROM public.products p
JOIN public.categories c ON c.id = p.category_id
WHERE p.status = 'active' AND p.stock_quantity > 0;
