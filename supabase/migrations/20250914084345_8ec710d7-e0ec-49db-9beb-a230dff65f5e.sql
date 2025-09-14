-- Create discount codes table
CREATE TABLE public.discount_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
  value NUMERIC NOT NULL CHECK (value > 0),
  min_order_amount NUMERIC DEFAULT 0,
  max_discount_amount NUMERIC,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  new_customers_only BOOLEAN DEFAULT FALSE,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  applicable_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create discount code usage tracking table
CREATE TABLE public.discount_code_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discount_code_id UUID NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  order_id UUID,
  customer_email TEXT NOT NULL,
  discount_amount NUMERIC NOT NULL,
  original_amount NUMERIC NOT NULL,
  final_amount NUMERIC NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Create indexes for performance
CREATE INDEX idx_discount_codes_code ON public.discount_codes(code);
CREATE INDEX idx_discount_codes_active ON public.discount_codes(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_discount_codes_validity ON public.discount_codes(valid_from, valid_until);
CREATE INDEX idx_discount_code_usage_code_id ON public.discount_code_usage(discount_code_id);
CREATE INDEX idx_discount_code_usage_customer ON public.discount_code_usage(customer_email);

-- Enable RLS
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discount_codes
CREATE POLICY "Admins can manage discount codes"
ON public.discount_codes
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Public can view active discount codes"
ON public.discount_codes
FOR SELECT
USING (is_active = TRUE AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until >= NOW()));

-- RLS Policies for discount_code_usage
CREATE POLICY "Admins can view all discount usage"
ON public.discount_code_usage
FOR SELECT
USING (is_admin());

CREATE POLICY "Service roles can manage discount usage"
ON public.discount_code_usage
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create trigger for updated_at
CREATE TRIGGER update_discount_codes_updated_at
BEFORE UPDATE ON public.discount_codes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Create validation function for discount codes
CREATE OR REPLACE FUNCTION public.validate_discount_code_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure percentage discounts are between 1 and 100
  IF NEW.type = 'percentage' AND (NEW.value <= 0 OR NEW.value > 100) THEN
    RAISE EXCEPTION 'Percentage discount must be between 1 and 100';
  END IF;
  
  -- Ensure valid_until is after valid_from
  IF NEW.valid_until IS NOT NULL AND NEW.valid_until <= NEW.valid_from THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;
  
  -- Ensure min_order_amount is not negative
  IF NEW.min_order_amount < 0 THEN
    RAISE EXCEPTION 'Minimum order amount cannot be negative';
  END IF;
  
  -- Ensure usage_limit is positive if set
  IF NEW.usage_limit IS NOT NULL AND NEW.usage_limit <= 0 THEN
    RAISE EXCEPTION 'Usage limit must be positive';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_discount_code_trigger
BEFORE INSERT OR UPDATE ON public.discount_codes
FOR EACH ROW
EXECUTE FUNCTION public.validate_discount_code_data();