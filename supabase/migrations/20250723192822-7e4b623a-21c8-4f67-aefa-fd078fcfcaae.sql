-- Phase 1: Critical Security & Data Foundation (Corrected)

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON public.promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_status_valid ON public.promotions(status, valid_from, valid_until);

-- Add database constraints for data validation
ALTER TABLE public.orders ADD CONSTRAINT check_positive_amounts 
CHECK (subtotal >= 0 AND total_amount >= 0 AND tax_amount >= 0);

ALTER TABLE public.products ADD CONSTRAINT check_positive_price 
CHECK (price >= 0);

ALTER TABLE public.products ADD CONSTRAINT check_non_negative_stock 
CHECK (stock_quantity >= 0);

ALTER TABLE public.customers ADD CONSTRAINT check_valid_email 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Insert sample categories
INSERT INTO public.categories (name, slug, description, sort_order) VALUES
('Pizza', 'pizza', 'Fresh wood-fired pizzas with premium ingredients', 1),
('Burgers', 'burgers', 'Gourmet burgers made with fresh ingredients', 2),
('Pasta', 'pasta', 'Authentic Italian pasta dishes', 3),
('Salads', 'salads', 'Fresh and healthy salad options', 4),
('Appetizers', 'appetizers', 'Delicious starters to begin your meal', 5),
('Desserts', 'desserts', 'Sweet treats to end your meal', 6),
('Beverages', 'beverages', 'Refreshing drinks and beverages', 7),
('Seafood', 'seafood', 'Fresh seafood dishes', 8)
ON CONFLICT (slug) DO NOTHING;

-- Insert sample products
INSERT INTO public.products (name, description, price, category_id, status, stock_quantity, sku) 
SELECT 
  product_name,
  description,
  price,
  (SELECT id FROM public.categories WHERE slug = category_slug),
  'active'::product_status,
  stock,
  sku
FROM (VALUES
  ('Margherita Pizza', 'Classic pizza with tomato sauce, mozzarella, and fresh basil', 18.99, 'pizza', 50, 'PIZZA-001'),
  ('Pepperoni Pizza', 'Traditional pizza with pepperoni and mozzarella cheese', 21.99, 'pizza', 45, 'PIZZA-002'),
  ('BBQ Chicken Pizza', 'BBQ sauce, grilled chicken, red onions, and cilantro', 24.99, 'pizza', 40, 'PIZZA-003'),
  ('Veggie Supreme Pizza', 'Bell peppers, mushrooms, onions, olives, and tomatoes', 22.99, 'pizza', 35, 'PIZZA-004'),
  ('Classic Cheeseburger', 'Beef patty with cheese, lettuce, tomato, and pickles', 15.99, 'burgers', 60, 'BURGER-001'),
  ('Bacon Burger', 'Beef patty with bacon, cheese, and special sauce', 18.99, 'burgers', 55, 'BURGER-002'),
  ('Veggie Burger', 'Plant-based patty with fresh vegetables', 16.99, 'burgers', 40, 'BURGER-003'),
  ('Double Cheese Burger', 'Two beef patties with double cheese', 21.99, 'burgers', 35, 'BURGER-004'),
  ('Spaghetti Carbonara', 'Classic Italian pasta with eggs, cheese, and pancetta', 19.99, 'pasta', 30, 'PASTA-001'),
  ('Penne Arrabbiata', 'Penne pasta with spicy tomato sauce', 17.99, 'pasta', 35, 'PASTA-002'),
  ('Fettuccine Alfredo', 'Creamy white sauce with fettuccine pasta', 20.99, 'pasta', 32, 'PASTA-003'),
  ('Lasagna', 'Layered pasta with meat sauce and cheese', 23.99, 'pasta', 25, 'PASTA-004'),
  ('Caesar Salad', 'Romaine lettuce, parmesan, croutons, and Caesar dressing', 12.99, 'salads', 50, 'SALAD-001'),
  ('Greek Salad', 'Mixed greens, feta cheese, olives, and Greek dressing', 14.99, 'salads', 45, 'SALAD-002'),
  ('Chicken Caesar Salad', 'Caesar salad topped with grilled chicken', 16.99, 'salads', 40, 'SALAD-003'),
  ('Garden Salad', 'Fresh mixed greens with seasonal vegetables', 11.99, 'salads', 55, 'SALAD-004'),
  ('Mozzarella Sticks', 'Crispy fried mozzarella with marinara sauce', 8.99, 'appetizers', 70, 'APP-001'),
  ('Chicken Wings', 'Spicy buffalo wings with blue cheese dip', 12.99, 'appetizers', 65, 'APP-002'),
  ('Garlic Bread', 'Toasted bread with garlic butter and herbs', 6.99, 'appetizers', 80, 'APP-003'),
  ('Onion Rings', 'Crispy beer-battered onion rings', 7.99, 'appetizers', 75, 'APP-004'),
  ('Chocolate Cake', 'Rich chocolate cake with chocolate frosting', 7.99, 'desserts', 30, 'DESSERT-001'),
  ('Cheesecake', 'New York style cheesecake with berry topping', 8.99, 'desserts', 25, 'DESSERT-002'),
  ('Tiramisu', 'Italian coffee-flavored dessert', 9.99, 'desserts', 20, 'DESSERT-003'),
  ('Ice Cream Sundae', 'Vanilla ice cream with chocolate sauce and nuts', 6.99, 'desserts', 40, 'DESSERT-004'),
  ('Coca Cola', 'Refreshing cola drink', 2.99, 'beverages', 100, 'BEV-001'),
  ('Fresh Orange Juice', 'Freshly squeezed orange juice', 4.99, 'beverages', 50, 'BEV-002'),
  ('Coffee', 'Premium roasted coffee', 3.99, 'beverages', 80, 'BEV-003'),
  ('Iced Tea', 'Fresh brewed iced tea', 3.49, 'beverages', 75, 'BEV-004'),
  ('Grilled Salmon', 'Fresh Atlantic salmon with herbs', 26.99, 'seafood', 25, 'SEAFOOD-001'),
  ('Fish & Chips', 'Beer-battered fish with crispy fries', 19.99, 'seafood', 30, 'SEAFOOD-002')
) AS products(product_name, description, price, category_slug, stock, sku)
ON CONFLICT (sku) DO NOTHING;

-- Insert sample customers
INSERT INTO public.customers (name, email, phone, date_of_birth) VALUES
('John Smith', 'john.smith@email.com', '+1-555-0101', '1985-03-15'),
('Sarah Johnson', 'sarah.johnson@email.com', '+1-555-0102', '1990-07-22'),
('Michael Brown', 'michael.brown@email.com', '+1-555-0103', '1988-11-08'),
('Emily Davis', 'emily.davis@email.com', '+1-555-0104', '1992-01-30'),
('David Wilson', 'david.wilson@email.com', '+1-555-0105', '1987-09-12'),
('Lisa Garcia', 'lisa.garcia@email.com', '+1-555-0106', '1991-05-18'),
('Robert Martinez', 'robert.martinez@email.com', '+1-555-0107', '1986-12-03'),
('Jennifer Lee', 'jennifer.lee@email.com', '+1-555-0108', '1989-08-25'),
('William Taylor', 'william.taylor@email.com', '+1-555-0109', '1993-04-07'),
('Amanda Anderson', 'amanda.anderson@email.com', '+1-555-0110', '1984-10-14'),
('James White', 'james.white@email.com', '+1-555-0111', '1990-02-28'),
('Jessica Thomas', 'jessica.thomas@email.com', '+1-555-0112', '1987-06-11'),
('Christopher Harris', 'christopher.harris@email.com', '+1-555-0113', '1991-12-19'),
('Michelle Clark', 'michelle.clark@email.com', '+1-555-0114', '1988-03-26'),
('Daniel Lewis', 'daniel.lewis@email.com', '+1-555-0115', '1989-09-02')
ON CONFLICT (email) DO NOTHING;

-- Insert sample orders with correct status values
INSERT INTO public.orders (
  order_number, customer_name, customer_email, customer_phone, 
  status, payment_status, order_type, subtotal, tax_amount, 
  total_amount, delivery_address, special_instructions
) VALUES
('ORD000001', 'John Smith', 'john.smith@email.com', '+1-555-0101', 
 'delivered', 'paid', 'delivery', 45.97, 3.68, 49.65,
 '123 Main St, Anytown, ST 12345', 'Please ring doorbell'),
('ORD000002', 'Sarah Johnson', 'sarah.johnson@email.com', '+1-555-0102',
 'preparing', 'paid', 'pickup', 32.98, 2.64, 35.62,
 NULL, 'Extra sauce on the side'),
('ORD000003', 'Michael Brown', 'michael.brown@email.com', '+1-555-0103',
 'pending', 'pending', 'delivery', 67.96, 5.44, 73.40,
 '456 Oak Ave, Anytown, ST 12345', NULL),
('ORD000004', 'Emily Davis', 'emily.davis@email.com', '+1-555-0104',
 'out_for_delivery', 'paid', 'delivery', 28.99, 2.32, 31.31,
 '789 Pine Rd, Anytown, ST 12345', 'Leave at front door'),
('ORD000005', 'David Wilson', 'david.wilson@email.com', '+1-555-0105',
 'ready', 'paid', 'pickup', 41.95, 3.36, 45.31,
 NULL, 'No onions please')
ON CONFLICT (order_number) DO NOTHING;

-- Add sample order items
INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
SELECT 
  o.id,
  p.id,
  p.name,
  CASE 
    WHEN o.order_number = 'ORD000001' AND p.sku = 'PIZZA-001' THEN 2
    WHEN o.order_number = 'ORD000001' AND p.sku = 'BEV-001' THEN 2
    WHEN o.order_number = 'ORD000002' AND p.sku = 'BURGER-001' THEN 1
    WHEN o.order_number = 'ORD000002' AND p.sku = 'APP-001' THEN 1
    WHEN o.order_number = 'ORD000002' AND p.sku = 'BEV-002' THEN 1
    WHEN o.order_number = 'ORD000003' AND p.sku = 'PIZZA-003' THEN 2
    WHEN o.order_number = 'ORD000003' AND p.sku = 'PASTA-001' THEN 1
    WHEN o.order_number = 'ORD000004' AND p.sku = 'SALAD-003' THEN 1
    WHEN o.order_number = 'ORD000004' AND p.sku = 'DESSERT-001' THEN 1
    WHEN o.order_number = 'ORD000004' AND p.sku = 'BEV-003' THEN 1
    WHEN o.order_number = 'ORD000005' AND p.sku = 'SEAFOOD-001' THEN 1
    WHEN o.order_number = 'ORD000005' AND p.sku = 'SALAD-001' THEN 1
    ELSE 0
  END,
  p.price,
  CASE 
    WHEN o.order_number = 'ORD000001' AND p.sku = 'PIZZA-001' THEN p.price * 2
    WHEN o.order_number = 'ORD000001' AND p.sku = 'BEV-001' THEN p.price * 2
    WHEN o.order_number = 'ORD000002' AND p.sku = 'BURGER-001' THEN p.price * 1
    WHEN o.order_number = 'ORD000002' AND p.sku = 'APP-001' THEN p.price * 1
    WHEN o.order_number = 'ORD000002' AND p.sku = 'BEV-002' THEN p.price * 1
    WHEN o.order_number = 'ORD000003' AND p.sku = 'PIZZA-003' THEN p.price * 2
    WHEN o.order_number = 'ORD000003' AND p.sku = 'PASTA-001' THEN p.price * 1
    WHEN o.order_number = 'ORD000004' AND p.sku = 'SALAD-003' THEN p.price * 1
    WHEN o.order_number = 'ORD000004' AND p.sku = 'DESSERT-001' THEN p.price * 1
    WHEN o.order_number = 'ORD000004' AND p.sku = 'BEV-003' THEN p.price * 1
    WHEN o.order_number = 'ORD000005' AND p.sku = 'SEAFOOD-001' THEN p.price * 1
    WHEN o.order_number = 'ORD000005' AND p.sku = 'SALAD-001' THEN p.price * 1
    ELSE 0
  END
FROM public.orders o
CROSS JOIN public.products p
WHERE (
  (o.order_number = 'ORD000001' AND p.sku IN ('PIZZA-001', 'BEV-001')) OR
  (o.order_number = 'ORD000002' AND p.sku IN ('BURGER-001', 'APP-001', 'BEV-002')) OR
  (o.order_number = 'ORD000003' AND p.sku IN ('PIZZA-003', 'PASTA-001')) OR
  (o.order_number = 'ORD000004' AND p.sku IN ('SALAD-003', 'DESSERT-001', 'BEV-003')) OR
  (o.order_number = 'ORD000005' AND p.sku IN ('SEAFOOD-001', 'SALAD-001'))
)
ON CONFLICT DO NOTHING;

-- Insert sample promotions
INSERT INTO public.promotions (name, code, type, value, description, min_order_amount, max_discount_amount, usage_limit, status, valid_from, valid_until) VALUES
('Welcome Discount', 'WELCOME10', 'percentage', 10, 'Welcome discount for new customers', 25.00, 10.00, 100, 'active', now(), now() + interval '30 days'),
('Free Delivery', 'FREEDEL', 'free_delivery', 0, 'Free delivery on orders over $30', 30.00, NULL, 200, 'active', now(), now() + interval '60 days'),
('Pizza Special', 'PIZZA20', 'percentage', 20, '20% off all pizza orders', 15.00, 15.00, 50, 'active', now(), now() + interval '14 days'),
('Weekend Deal', 'WEEKEND15', 'fixed_amount', 15, '$15 off weekend orders', 50.00, NULL, 75, 'active', now(), now() + interval '7 days')
ON CONFLICT (code) DO NOTHING;