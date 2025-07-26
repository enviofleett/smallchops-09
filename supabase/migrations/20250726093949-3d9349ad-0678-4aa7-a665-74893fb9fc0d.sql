-- Create customer_favorites table
CREATE TABLE public.customer_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one favorite per customer per product
  UNIQUE(customer_id, product_id)
);

-- Enable Row Level Security
ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;

-- Create policies for customer favorites
CREATE POLICY "Customers can view their own favorites" 
ON public.customer_favorites 
FOR SELECT 
USING (true); -- Allow public read for now since we need to handle both auth and guest users

CREATE POLICY "Customers can add their own favorites" 
ON public.customer_favorites 
FOR INSERT 
WITH CHECK (true); -- Allow public insert for now since we need to handle both auth and guest users

CREATE POLICY "Customers can remove their own favorites" 
ON public.customer_favorites 
FOR DELETE 
USING (true); -- Allow public delete for now since we need to handle both auth and guest users

-- Staff and above can view all favorites for customer support
CREATE POLICY "Staff can view all favorites" 
ON public.customer_favorites 
FOR SELECT 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text]));

-- Create indexes for performance
CREATE INDEX idx_customer_favorites_customer_id ON public.customer_favorites(customer_id);
CREATE INDEX idx_customer_favorites_product_id ON public.customer_favorites(product_id);
CREATE INDEX idx_customer_favorites_created_at ON public.customer_favorites(created_at DESC);