-- Fix function search path security warning for the payment transaction function
CREATE OR REPLACE FUNCTION update_payment_transaction_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;