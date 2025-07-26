import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type ProductReview = Database['public']['Tables']['product_reviews']['Row'] & {
  customer_accounts?: {
    name: string;
  };
  review_responses?: ReviewResponse[];
  products?: {
    id: string;
    name: string;
    image_url: string | null;
  };
};

export type ReviewResponse = Database['public']['Tables']['review_responses']['Row'];

export type ProductRatingSummary = Database['public']['Tables']['product_ratings_summary']['Row'];

export type ReviewVote = Database['public']['Tables']['review_votes']['Row'];

export interface CreateReviewData {
  product_id: string;
  rating: number;
  title?: string;
  content?: string;
  order_id?: string;
}

// Get reviews for a product
export const getProductReviews = async (
  productId: string,
  options: {
    page?: number;
    limit?: number;
    rating?: number;
    sortBy?: 'newest' | 'oldest' | 'helpful' | 'rating_high' | 'rating_low';
  } = {}
): Promise<{ reviews: ProductReview[]; total: number }> => {
  const { page = 1, limit = 10, rating, sortBy = 'newest' } = options;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('product_reviews')
    .select(`
      *,
      customer_accounts!inner(name),
      review_responses(*)
    `)
    .eq('product_id', productId)
    .eq('status', 'active');

  if (rating) {
    query = query.eq('rating', rating);
  }

  // Apply sorting
  switch (sortBy) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'helpful':
      query = query.order('helpful_votes', { ascending: false });
      break;
    case 'rating_high':
      query = query.order('rating', { ascending: false });
      break;
    case 'rating_low':
      query = query.order('rating', { ascending: true });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  // Get total count
  const { count } = await supabase
    .from('product_reviews')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', productId)
    .eq('status', 'active');

  // Get paginated reviews
  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  return {
    reviews: data || [],
    total: count || 0,
  };
};

// Get rating summary for a product
export const getProductRatingSummary = async (productId: string): Promise<ProductRatingSummary | null> => {
  const { data, error } = await supabase
    .from('product_ratings_summary')
    .select('*')
    .eq('product_id', productId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(error.message);
  }

  return data;
};

// Create a new review
export const createReview = async (reviewData: CreateReviewData): Promise<ProductReview> => {
  // Get current customer account
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in to create a review');

  const { data: customerAccount, error: customerError } = await supabase
    .from('customer_accounts')
    .select('id, name')
    .eq('user_id', user.id)
    .single();

  if (customerError || !customerAccount) {
    throw new Error('Customer account not found');
  }

  // Check if customer already reviewed this product
  const { data: existingReview } = await supabase
    .from('product_reviews')
    .select('id')
    .eq('product_id', reviewData.product_id)
    .eq('customer_id', customerAccount.id)
    .single();

  if (existingReview) {
    throw new Error('You have already reviewed this product');
  }

  // Check if customer purchased the product
  const { data: purchaseVerification, error: verificationError } = await supabase
    .rpc('customer_purchased_product', {
      customer_uuid: customerAccount.id,
      product_uuid: reviewData.product_id
    });

  if (verificationError) {
    console.warn('Could not verify purchase:', verificationError);
  }

  const { data, error } = await supabase
    .from('product_reviews')
    .insert({
      ...reviewData,
      customer_id: customerAccount.id,
      customer_email: customerAccount.name,
      is_verified_purchase: purchaseVerification || false,
    })
    .select(`
      *,
      customer_accounts!inner(name),
      review_responses(*)
    `)
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// Update an existing review
export const updateReview = async (
  reviewId: string,
  updates: Partial<Pick<ProductReview, 'rating' | 'title' | 'content'>>
): Promise<ProductReview> => {
  const { data, error } = await supabase
    .from('product_reviews')
    .update(updates)
    .eq('id', reviewId)
    .select(`
      *,
      customer_accounts!inner(name),
      review_responses(*)
    `)
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// Delete a review
export const deleteReview = async (reviewId: string): Promise<void> => {
  const { error } = await supabase
    .from('product_reviews')
    .delete()
    .eq('id', reviewId);

  if (error) throw new Error(error.message);
};

// Vote on review helpfulness
export const voteOnReview = async (
  reviewId: string,
  voteType: 'helpful' | 'not_helpful'
): Promise<void> => {
  // Get current customer account
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in to vote');

  const { data: customerAccount, error: customerError } = await supabase
    .from('customer_accounts')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (customerError || !customerAccount) {
    throw new Error('Customer account not found');
  }

  // Upsert the vote (insert or update if exists)
  const { error } = await supabase
    .from('review_votes')
    .upsert({
      review_id: reviewId,
      customer_id: customerAccount.id,
      vote_type: voteType,
    });

  if (error) throw new Error(error.message);
};

// Get customer's reviews
export const getCustomerReviews = async (
  options: {
    page?: number;
    limit?: number;
  } = {}
): Promise<{ reviews: ProductReview[]; total: number }> => {
  const { page = 1, limit = 10 } = options;
  const offset = (page - 1) * limit;

  // Get current customer account
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in');

  const { data: customerAccount, error: customerError } = await supabase
    .from('customer_accounts')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (customerError || !customerAccount) {
    throw new Error('Customer account not found');
  }

  // Get total count
  const { count } = await supabase
    .from('product_reviews')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customerAccount.id);

  // Get paginated reviews with product info
  const { data, error } = await supabase
    .from('product_reviews')
    .select(`
      *,
      products!inner(id, name, image_url),
      review_responses(*)
    `)
    .eq('customer_id', customerAccount.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  return {
    reviews: data || [],
    total: count || 0,
  };
};

// Create business response to review
export const createReviewResponse = async (
  reviewId: string,
  responseContent: string
): Promise<ReviewResponse> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in to respond');

  const { data, error } = await supabase
    .from('review_responses')
    .insert({
      review_id: reviewId,
      business_user_id: user.id,
      response_content: responseContent,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};