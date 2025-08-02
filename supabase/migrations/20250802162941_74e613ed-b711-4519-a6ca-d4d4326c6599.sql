-- Add VAT configuration to business settings
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS default_vat_rate NUMERIC(5,2) DEFAULT 7.5;

-- Add VAT fields to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 7.5,
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) GENERATED ALWAYS AS (
  CASE 
    WHEN vat_rate > 0 THEN ROUND(price / (1 + (vat_rate / 100)), 2)
    ELSE price
  END
) STORED,
ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10,2) GENERATED ALWAYS AS (
  CASE 
    WHEN vat_rate > 0 THEN price - ROUND(price / (1 + (vat_rate / 100)), 2)
    ELSE 0
  END
) STORED;

-- Add VAT breakdown to orders table for proper tracking
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS subtotal_cost NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_vat NUMERIC(10,2) DEFAULT 0;

-- Add VAT breakdown to order_items table
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 7.5;

-- Create function to calculate VAT breakdown for cart items
CREATE OR REPLACE FUNCTION public.calculate_vat_breakdown(
  cart_items JSONB,
  delivery_fee NUMERIC DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item JSONB;
  subtotal_cost NUMERIC := 0;
  total_vat NUMERIC := 0;
  total_price NUMERIC := 0;
  result JSONB;
BEGIN
  -- Calculate breakdown for each item
  FOR item IN SELECT * FROM jsonb_array_elements(cart_items)
  LOOP
    -- Get product VAT rate
    DECLARE
      product_vat_rate NUMERIC;
      item_total_price NUMERIC;
      item_cost_price NUMERIC;
      item_vat_amount NUMERIC;
    BEGIN
      SELECT vat_rate INTO product_vat_rate 
      FROM products 
      WHERE id = (item->>'product_id')::UUID;
      
      product_vat_rate := COALESCE(product_vat_rate, 7.5);
      item_total_price := (item->>'price')::NUMERIC * (item->>'quantity')::INTEGER;
      
      -- Calculate cost and VAT for this item
      item_cost_price := ROUND(item_total_price / (1 + (product_vat_rate / 100)), 2);
      item_vat_amount := item_total_price - item_cost_price;
      
      subtotal_cost := subtotal_cost + item_cost_price;
      total_vat := total_vat + item_vat_amount;
      total_price := total_price + item_total_price;
    END;
  END LOOP;
  
  result := jsonb_build_object(
    'subtotal_cost', subtotal_cost,
    'total_vat', total_vat,
    'delivery_fee', delivery_fee,
    'grand_total', total_price + delivery_fee
  );
  
  RETURN result;
END;
$$;