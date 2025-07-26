-- Fix function search path security warnings
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Fix function search path security warnings
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Fix function search path security warnings
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';