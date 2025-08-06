-- Debug the create_order_with_items function to identify the root cause
-- First, let's test the function manually with the failing data

SELECT public.create_order_with_items(
  'chudesyl@gmail.com'::text,  -- p_customer_email
  'Chinedu Victor'::text,      -- p_customer_name
  '[{"product_id": "b91936fd-a0e3-47a4-9817-58e5c8c919cf", "quantity": 2, "unit_price": 2000, "discount_amount": 0}]'::jsonb,  -- p_items
  '+2349120020048'::text,      -- p_customer_phone
  'delivery'::text,            -- p_fulfillment_type
  '{"address_line_1": "FCT", "address_line_2": "", "city": "FCT", "state": "Lagos", "postal_code": "", "landmark": ""}'::jsonb,  -- p_delivery_address
  'guest_246f8bff-777d-4ffb-a247-56025e16475d'::text,  -- p_guest_session_id
  'paystack'::text,            -- p_payment_method
  '5f825d0f-b13c-45cc-a2f5-5ea733133d90'::uuid,       -- p_delivery_zone_id
  3000::numeric,               -- p_delivery_fee
  6990::numeric                -- p_total_amount
);