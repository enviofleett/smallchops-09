-- Create product reviews table
CREATE TABLE public.product_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
  helpful_votes INTEGER NOT NULL DEFAULT 0,
  total_votes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'flagged')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, customer_id)
);

-- Create review votes table for helpfulness voting
CREATE TABLE public.review_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('helpful', 'not_helpful')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(review_id, customer_id)
);

-- Create product ratings summary table for performance
CREATE TABLE public.product_ratings_summary (
  product_id UUID NOT NULL PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  average_rating DECIMAL(3,2) NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  rating_distribution JSONB NOT NULL DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0}',
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create review media table for photos/videos
CREATE TABLE public.review_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  alt_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create business responses table
CREATE TABLE public.review_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  business_user_id UUID NOT NULL,
  response_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ratings_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_reviews
CREATE POLICY "Anyone can view active reviews" 
ON public.product_reviews 
FOR SELECT 
USING (status = 'active');

CREATE POLICY "Customers can create reviews for their purchases" 
ON public.product_reviews 
FOR INSERT 
WITH CHECK (
  customer_id IN (
    SELECT id FROM public.customer_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Customers can update their own reviews" 
ON public.product_reviews 
FOR UPDATE 
USING (
  customer_id IN (
    SELECT id FROM public.customer_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Staff can manage all reviews" 
ON public.product_reviews 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text]));

-- RLS Policies for review_votes
CREATE POLICY "Anyone can view votes" 
ON public.review_votes 
FOR SELECT 
USING (true);

CREATE POLICY "Customers can vote on reviews" 
ON public.review_votes 
FOR ALL 
USING (
  customer_id IN (
    SELECT id FROM public.customer_accounts WHERE user_id = auth.uid()
  )
);

-- RLS Policies for product_ratings_summary
CREATE POLICY "Anyone can view rating summaries" 
ON public.product_ratings_summary 
FOR SELECT 
USING (true);

CREATE POLICY "Service roles can manage rating summaries" 
ON public.product_ratings_summary 
FOR ALL 
USING (auth.role() = 'service_role');

-- RLS Policies for review_media
CREATE POLICY "Anyone can view review media" 
ON public.review_media 
FOR SELECT 
USING (true);

CREATE POLICY "Review authors can manage their media" 
ON public.review_media 
FOR ALL 
USING (
  review_id IN (
    SELECT id FROM public.product_reviews 
    WHERE customer_id IN (
      SELECT id FROM public.customer_accounts WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies for review_responses
CREATE POLICY "Anyone can view business responses" 
ON public.review_responses 
FOR SELECT 
USING (true);

CREATE POLICY "Staff can create responses" 
ON public.review_responses 
FOR INSERT 
WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text]));

CREATE POLICY "Staff can update their responses" 
ON public.review_responses 
FOR UPDATE 
USING (business_user_id = auth.uid());

-- Function to update rating summary when reviews change
CREATE OR REPLACE FUNCTION public.update_product_rating_summary()
RETURNS TRIGGER AS $$
DECLARE
  product_uuid UUID;
  avg_rating DECIMAL(3,2);
  review_count INTEGER;
  rating_dist JSONB;
BEGIN
  -- Get the product_id from either NEW or OLD record
  product_uuid := COALESCE(NEW.product_id, OLD.product_id);
  
  -- Calculate new statistics
  SELECT 
    ROUND(AVG(rating), 2),
    COUNT(*),
    jsonb_build_object(
      '1', COUNT(*) FILTER (WHERE rating = 1),
      '2', COUNT(*) FILTER (WHERE rating = 2),
      '3', COUNT(*) FILTER (WHERE rating = 3),
      '4', COUNT(*) FILTER (WHERE rating = 4),
      '5', COUNT(*) FILTER (WHERE rating = 5)
    )
  INTO avg_rating, review_count, rating_dist
  FROM public.product_reviews 
  WHERE product_id = product_uuid AND status = 'active';
  
  -- Upsert the summary
  INSERT INTO public.product_ratings_summary (
    product_id, 
    average_rating, 
    total_reviews, 
    rating_distribution, 
    last_updated
  ) 
  VALUES (
    product_uuid, 
    COALESCE(avg_rating, 0), 
    COALESCE(review_count, 0), 
    COALESCE(rating_dist, '{"1":0,"2":0,"3":0,"4":0,"5":0}'), 
    NOW()
  )
  ON CONFLICT (product_id) 
  DO UPDATE SET
    average_rating = EXCLUDED.average_rating,
    total_reviews = EXCLUDED.total_reviews,
    rating_distribution = EXCLUDED.rating_distribution,
    last_updated = EXCLUDED.last_updated;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update review helpfulness when votes change
CREATE OR REPLACE FUNCTION public.update_review_helpfulness()
RETURNS TRIGGER AS $$
DECLARE
  review_uuid UUID;
  helpful_count INTEGER;
  total_count INTEGER;
BEGIN
  -- Get the review_id from either NEW or OLD record
  review_uuid := COALESCE(NEW.review_id, OLD.review_id);
  
  -- Calculate vote counts
  SELECT 
    COUNT(*) FILTER (WHERE vote_type = 'helpful'),
    COUNT(*)
  INTO helpful_count, total_count
  FROM public.review_votes 
  WHERE review_id = review_uuid;
  
  -- Update the review
  UPDATE public.product_reviews 
  SET 
    helpful_votes = COALESCE(helpful_count, 0),
    total_votes = COALESCE(total_count, 0),
    updated_at = NOW()
  WHERE id = review_uuid;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if customer purchased product
CREATE OR REPLACE FUNCTION public.customer_purchased_product(customer_uuid UUID, product_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.orders o
    JOIN public.order_items oi ON o.id = oi.order_id
    JOIN public.customer_accounts ca ON o.customer_email = ca.name OR o.customer_email = ca.phone
    WHERE ca.id = customer_uuid 
    AND oi.product_id = product_uuid 
    AND o.status = 'completed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
CREATE TRIGGER update_product_rating_summary_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_rating_summary();

CREATE TRIGGER update_review_helpfulness_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.review_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_review_helpfulness();

CREATE TRIGGER set_updated_at_product_reviews
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_updated_at_review_responses
  BEFORE UPDATE ON public.review_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Indexes for performance
CREATE INDEX idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX idx_product_reviews_customer_id ON public.product_reviews(customer_id);
CREATE INDEX idx_product_reviews_status ON public.product_reviews(status);
CREATE INDEX idx_product_reviews_rating ON public.product_reviews(rating);
CREATE INDEX idx_product_reviews_created_at ON public.product_reviews(created_at DESC);
CREATE INDEX idx_review_votes_review_id ON public.review_votes(review_id);
CREATE INDEX idx_review_votes_customer_id ON public.review_votes(customer_id);
CREATE INDEX idx_review_media_review_id ON public.review_media(review_id);
CREATE INDEX idx_review_responses_review_id ON public.review_responses(review_id);