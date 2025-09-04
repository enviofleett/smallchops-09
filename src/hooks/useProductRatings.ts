import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProductRating {
  id: string;
  rating: number;
  content?: string;
  created_at: string;
  customer_name: string;
  is_verified_purchase: boolean;
  helpful_votes: number;
}

export interface RatingSummary {
  product_id: string;
  total_reviews: number;
  average_rating: number;
  rating_distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export const useProductRatings = (productId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch rating summary - simple calculation from existing reviews
  const { data: ratingSummary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['product-rating-summary', productId],
    queryFn: async () => {
      const { data: reviews } = await supabase
        .from('product_reviews')
        .select('rating')
        .eq('product_id', productId)
        .eq('status', 'active');

      if (!reviews || reviews.length === 0) {
        return {
          product_id: productId,
          total_reviews: 0,
          average_rating: 0,
          rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };
      }

      const totalReviews = reviews.length;
      const average = reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;
      
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      reviews.forEach(review => {
        distribution[review.rating as keyof typeof distribution]++;
      });

      return {
        product_id: productId,
        total_reviews: totalReviews,
        average_rating: Math.round(average * 10) / 10,
        rating_distribution: distribution
      } as RatingSummary;
    },
    enabled: !!productId,
  });

  // Fetch reviews with customer info - simplified
  const { data: reviews, isLoading: isLoadingReviews } = useQuery({
    queryKey: ['product-reviews', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', productId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching reviews:', error);
        return [];
      }

      return data?.map(review => ({
        id: review.id,
        rating: review.rating,
        content: review.content,
        created_at: review.created_at,
        customer_name: review.customer_email?.split('@')[0] || 'Customer',
        is_verified_purchase: review.is_verified_purchase || false,
        helpful_votes: review.helpful_votes || 0
      })) as ProductRating[] || [];
    },
    enabled: !!productId,
  });

  return {
    ratingSummary,
    reviews,
    isLoadingSummary,
    isLoadingReviews,
    submitReview: () => {},
    isSubmittingReview: false,
    toggleHelpfulness: () => {},
    isUpdatingHelpfulness: false,
  };
};