-- Fix security warning for the VAT calculation function
CREATE OR REPLACE FUNCTION public.calculate_vat_breakdown(
  cart_items JSONB,
  delivery_fee NUMERIC DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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