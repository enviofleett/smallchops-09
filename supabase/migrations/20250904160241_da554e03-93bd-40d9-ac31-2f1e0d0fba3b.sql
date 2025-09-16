-- Create user_favorites table
CREATE TABLE public.user_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique combination of user and product
  CONSTRAINT unique_user_product_favorite UNIQUE (user_id, product_id)
);

-- Add foreign key reference to products table
ALTER TABLE public.user_favorites 
ADD CONSTRAINT user_favorites_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_favorites
-- Users can only manage their own favorites
CREATE POLICY "Users can view their own favorites"
ON public.user_favorites
FOR SELECT
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Users can add their own favorites"
ON public.user_favorites
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Users can remove their own favorites"
ON public.user_favorites
FOR DELETE
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Admins can view all favorites for analytics
CREATE POLICY "Admins can view all favorites"
ON public.user_favorites
FOR SELECT
USING (is_admin());

-- Create index for better performance
CREATE INDEX idx_user_favorites_user_id ON public.user_favorites(user_id);
CREATE INDEX idx_user_favorites_product_id ON public.user_favorites(product_id);
CREATE INDEX idx_user_favorites_created_at ON public.user_favorites(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_favorites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_favorites_updated_at
  BEFORE UPDATE ON public.user_favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_favorites_updated_at();

-- Create function to get user's favorite products with product details
CREATE OR REPLACE FUNCTION public.get_user_favorites_with_products(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  favorite_id UUID,
  product_id UUID,
  product_name TEXT,
  product_price NUMERIC,
  product_image_url TEXT,
  product_status product_status,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure user can only access their own favorites or admin can access all
  IF NOT (p_user_id = auth.uid() OR is_admin()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    uf.id as favorite_id,
    uf.product_id,
    p.name as product_name,
    p.price as product_price,
    p.image_url as product_image_url,
    p.status as product_status,
    uf.created_at
  FROM user_favorites uf
  INNER JOIN products p ON uf.product_id = p.id
  WHERE uf.user_id = p_user_id
    AND p.status = 'active'
  ORDER BY uf.created_at DESC;
END;
$$;

-- Create function to toggle favorite status
CREATE OR REPLACE FUNCTION public.toggle_user_favorite(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_favorite_exists BOOLEAN;
  v_product_exists BOOLEAN;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if product exists and is active
  SELECT EXISTS (
    SELECT 1 FROM products 
    WHERE id = p_product_id AND status = 'active'
  ) INTO v_product_exists;
  
  IF NOT v_product_exists THEN
    RAISE EXCEPTION 'Product not found or inactive';
  END IF;
  
  -- Check if favorite already exists
  SELECT EXISTS (
    SELECT 1 FROM user_favorites 
    WHERE user_id = v_user_id AND product_id = p_product_id
  ) INTO v_favorite_exists;
  
  IF v_favorite_exists THEN
    -- Remove from favorites
    DELETE FROM user_favorites 
    WHERE user_id = v_user_id AND product_id = p_product_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'is_favorite', false,
      'action', 'removed',
      'message', 'Product removed from favorites'
    );
  ELSE
    -- Add to favorites
    INSERT INTO user_favorites (user_id, product_id)
    VALUES (v_user_id, p_product_id);
    
    RETURN jsonb_build_object(
      'success', true,
      'is_favorite', true,
      'action', 'added',
      'message', 'Product added to favorites'
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to toggle favorite status'
    );
END;
$$;