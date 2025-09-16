-- Fix the get_detailed_order_with_products function type mismatch
-- This fixes the RPC error "Returned type order_status does not match expected type text in column 6"

DROP FUNCTION IF EXISTS get_detailed_order_with_products(uuid);

CREATE OR REPLACE FUNCTION get_detailed_order_with_products(p_order_id uuid)
RETURNS TABLE(
  id uuid,
  order_number text,
  customer_name text,
  customer_email text,
  customer_phone text,
  order_type text,
  status text,  -- Changed from order_status to text to fix type mismatch
  payment_status text,
  total_amount numeric,
  delivery_address jsonb,
  order_time timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  order_items jsonb,
  delivery_zones jsonb,
  order_delivery_schedule jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.order_type,
    o.status::text,  -- Explicit cast to text
    o.payment_status::text,  -- Explicit cast to text
    o.total_amount,
    o.delivery_address,
    o.order_time,
    o.created_at,
    o.updated_at,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'total_price', oi.total_price,
          'product_name', oi.product_name,
          'product', CASE 
            WHEN p.id IS NOT NULL THEN
              jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'description', p.description,
                'price', p.price,
                'image_url', p.image_url,
                'category_id', p.category_id,
                'features', p.features,
                'ingredients', p.ingredients
              )
            ELSE NULL
          END
        )
      ) FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = o.id), 
      '[]'::jsonb
    ) as order_items,
    CASE 
      WHEN dz.id IS NOT NULL THEN
        jsonb_build_object(
          'id', dz.id,
          'name', dz.name,
          'base_fee', dz.base_fee,
          'is_active', dz.is_active
        )
      ELSE NULL
    END as delivery_zones,
    CASE 
      WHEN ods.id IS NOT NULL THEN
        jsonb_build_object(
          'id', ods.id,
          'delivery_date', ods.delivery_date,
          'delivery_time_start', ods.delivery_time_start,
          'delivery_time_end', ods.delivery_time_end,
          'is_flexible', ods.is_flexible,
          'special_instructions', ods.special_instructions
        )
      ELSE NULL
    END as order_delivery_schedule
  FROM orders o
  LEFT JOIN delivery_zones dz ON o.delivery_zone_id = dz.id  
  LEFT JOIN order_delivery_schedule ods ON o.id = ods.order_id
  WHERE o.id = p_order_id;
END;
$$;