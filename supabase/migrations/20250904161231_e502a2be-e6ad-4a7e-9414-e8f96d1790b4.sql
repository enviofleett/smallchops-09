-- Create product reviews table
CREATE TABLE public.product_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'flagged')),
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  moderated_at TIMESTAMP WITH TIME ZONE,
  moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  moderation_notes TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  -- Ensure one review per customer per product
  UNIQUE(product_id, customer_id)
);

-- Create product ratings summary table for performance
CREATE TABLE public.product_ratings_summary (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE PRIMARY KEY,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_1_count INTEGER NOT NULL DEFAULT 0,
  rating_2_count INTEGER NOT NULL DEFAULT 0,
  rating_3_count INTEGER NOT NULL DEFAULT 0,
  rating_4_count INTEGER NOT NULL DEFAULT 0,
  rating_5_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create review helpfulness tracking
CREATE TABLE public.review_helpfulness (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one vote per customer per review
  UNIQUE(review_id, customer_id)
);

-- Enable RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ratings_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_helpfulness ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_reviews
CREATE POLICY "Public can view active reviews" ON public.product_reviews
  FOR SELECT USING (status = 'active');

CREATE POLICY "Customers can create reviews for their purchases" ON public.product_reviews
  FOR INSERT WITH CHECK (
    customer_id IN (
      SELECT ca.id FROM customer_accounts ca WHERE ca.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can update their own pending reviews" ON public.product_reviews
  FOR UPDATE USING (
    customer_id IN (
      SELECT ca.id FROM customer_accounts ca WHERE ca.user_id = auth.uid()
    ) AND status = 'pending'
  );

CREATE POLICY "Admins can manage all reviews" ON public.product_reviews
  FOR ALL USING (is_admin());

-- RLS Policies for product_ratings_summary
CREATE POLICY "Public can view ratings summary" ON public.product_ratings_summary
  FOR SELECT USING (true);

CREATE POLICY "Service roles can manage ratings summary" ON public.product_ratings_summary
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for review_helpfulness
CREATE POLICY "Customers can manage their helpfulness votes" ON public.review_helpfulness
  FOR ALL USING (
    customer_id IN (
      SELECT ca.id FROM customer_accounts ca WHERE ca.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view helpfulness counts" ON public.review_helpfulness
  FOR SELECT USING (true);

-- Function to update ratings summary
CREATE OR REPLACE FUNCTION public.update_product_ratings_summary(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_reviews INTEGER;
  v_average_rating NUMERIC(3,2);
  v_rating_counts INTEGER[];
BEGIN
  -- Calculate summary data
  SELECT 
    COUNT(*),
    ROUND(AVG(rating::NUMERIC), 2),
    ARRAY[
      COUNT(*) FILTER (WHERE rating = 1),
      COUNT(*) FILTER (WHERE rating = 2),
      COUNT(*) FILTER (WHERE rating = 3),
      COUNT(*) FILTER (WHERE rating = 4),
      COUNT(*) FILTER (WHERE rating = 5)
    ]
  INTO v_total_reviews, v_average_rating, v_rating_counts
  FROM product_reviews
  WHERE product_id = p_product_id AND status = 'active';
  
  -- Upsert summary
  INSERT INTO product_ratings_summary (
    product_id, total_reviews, average_rating,
    rating_1_count, rating_2_count, rating_3_count, rating_4_count, rating_5_count
  ) VALUES (
    p_product_id, v_total_reviews, COALESCE(v_average_rating, 0),
    v_rating_counts[1], v_rating_counts[2], v_rating_counts[3], v_rating_counts[4], v_rating_counts[5]
  )
  ON CONFLICT (product_id)
  DO UPDATE SET
    total_reviews = EXCLUDED.total_reviews,
    average_rating = EXCLUDED.average_rating,
    rating_1_count = EXCLUDED.rating_1_count,
    rating_2_count = EXCLUDED.rating_2_count,
    rating_3_count = EXCLUDED.rating_3_count,
    rating_4_count = EXCLUDED.rating_4_count,
    rating_5_count = EXCLUDED.rating_5_count,
    updated_at = now();
END;
$$;

-- Function to get product reviews with customer info
CREATE OR REPLACE FUNCTION public.get_product_reviews_with_customer_info(p_product_id UUID, p_limit INTEGER DEFAULT 10, p_offset INTEGER DEFAULT 0)
RETURNS TABLE(
  id UUID,
  rating INTEGER,
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  customer_name TEXT,
  is_verified_purchase BOOLEAN,
  helpful_count INTEGER
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pr.rating,
    pr.review_text,
    pr.created_at,
    ca.name as customer_name,
    pr.is_verified_purchase,
    pr.helpful_count
  FROM product_reviews pr
  JOIN customer_accounts ca ON pr.customer_id = ca.id
  WHERE pr.product_id = p_product_id 
    AND pr.status = 'active'
  ORDER BY pr.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Function to submit product review
CREATE OR REPLACE FUNCTION public.submit_product_review(
  p_product_id UUID,
  p_rating INTEGER,
  p_review_text TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_review_id UUID;
  v_is_verified_purchase BOOLEAN := FALSE;
BEGIN
  -- Get customer account
  SELECT id INTO v_customer_id
  FROM customer_accounts
  WHERE user_id = auth.uid();
  
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer account not found');
  END IF;
  
  -- Validate rating
  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rating must be between 1 and 5');
  END IF;
  
  -- Check if customer has purchased this product
  IF p_order_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = p_order_id 
        AND o.customer_email = (SELECT email FROM customer_accounts WHERE id = v_customer_id)
        AND oi.product_id = p_product_id
        AND o.status = 'delivered'
    ) INTO v_is_verified_purchase;
  END IF;
  
  -- Insert review
  INSERT INTO product_reviews (
    product_id, customer_id, user_id, rating, review_text, 
    is_verified_purchase, order_id, status
  )
  VALUES (
    p_product_id, v_customer_id, auth.uid(), p_rating, p_review_text,
    v_is_verified_purchase, p_order_id, 'active' -- Auto-approve for now, can add moderation later
  )
  RETURNING id INTO v_review_id;
  
  -- Update ratings summary
  PERFORM update_product_ratings_summary(p_product_id);
  
  RETURN jsonb_build_object(
    'success', true, 
    'review_id', v_review_id,
    'is_verified_purchase', v_is_verified_purchase
  );
  
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already reviewed this product');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to submit review');
END;
$$;

-- Function to toggle review helpfulness
CREATE OR REPLACE FUNCTION public.toggle_review_helpfulness(p_review_id UUID, p_is_helpful BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_old_helpful BOOLEAN;
BEGIN
  -- Get customer account
  SELECT id INTO v_customer_id
  FROM customer_accounts
  WHERE user_id = auth.uid();
  
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer account not found');
  END IF;
  
  -- Check existing vote
  SELECT is_helpful INTO v_old_helpful
  FROM review_helpfulness
  WHERE review_id = p_review_id AND customer_id = v_customer_id;
  
  IF v_old_helpful IS NULL THEN
    -- Insert new vote
    INSERT INTO review_helpfulness (review_id, customer_id, user_id, is_helpful)
    VALUES (p_review_id, v_customer_id, auth.uid(), p_is_helpful);
    
    -- Update helpful count
    UPDATE product_reviews
    SET helpful_count = helpful_count + CASE WHEN p_is_helpful THEN 1 ELSE 0 END
    WHERE id = p_review_id;
  ELSE
    -- Update existing vote
    UPDATE review_helpfulness
    SET is_helpful = p_is_helpful
    WHERE review_id = p_review_id AND customer_id = v_customer_id;
    
    -- Update helpful count
    UPDATE product_reviews
    SET helpful_count = helpful_count + 
      CASE 
        WHEN p_is_helpful AND NOT v_old_helpful THEN 1
        WHEN NOT p_is_helpful AND v_old_helpful THEN -1
        ELSE 0
      END
    WHERE id = p_review_id;
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Trigger to update ratings summary when reviews change
CREATE OR REPLACE FUNCTION public.trigger_update_ratings_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_product_ratings_summary(OLD.product_id);
    RETURN OLD;
  ELSE
    PERFORM update_product_ratings_summary(NEW.product_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER update_ratings_summary_trigger
  AFTER INSERT OR UPDATE OR DELETE ON product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_ratings_summary();

-- Create indexes for performance
CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_customer_id ON product_reviews(customer_id);
CREATE INDEX idx_product_reviews_status ON product_reviews(status);
CREATE INDEX idx_product_reviews_created_at ON product_reviews(created_at DESC);
CREATE INDEX idx_review_helpfulness_review_id ON review_helpfulness(review_id);
CREATE INDEX idx_review_helpfulness_customer_id ON review_helpfulness(customer_id);