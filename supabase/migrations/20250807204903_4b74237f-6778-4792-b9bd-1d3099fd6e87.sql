-- Prepare E2E test: ensure Paystack test mode and seed a temporary product

-- 1) Force Paystack into TEST mode safely
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.payment_integrations WHERE provider='paystack') THEN
    UPDATE public.payment_integrations 
      SET test_mode = true 
    WHERE provider = 'paystack';
  END IF;
END $$;

-- 2) Seed a temporary test product (visible to customers via new RLS)
INSERT INTO public.products (
  id, name, description, sku, price, stock_quantity, image_url, status, created_at, updated_at, category_id
) VALUES (
  gen_random_uuid(),
  'E2E Test Smallchops Combo',
  'Temporary product for end-to-end test (safe to delete).',
  'E2E-TEST-ITEM',
  500.00,               -- NGN 500 test price
  100,                  -- plenty of stock
  'https://oknnklksdiqaifhxaccs.supabase.co/storage/v1/object/public/product-images/placeholder.svg',
  'active'::product_status,
  now(),
  now(),
  (SELECT id FROM public.categories LIMIT 1) -- null if none exists
)
ON CONFLICT (sku) DO NOTHING;