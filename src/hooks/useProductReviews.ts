import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getProductReviews, 
  getProductRatingSummary, 
  createReview, 
  voteOnReview,
  ProductReview,
  ProductRatingSummary,
  CreateReviewData 
} from '@/api/reviews';

export const useProductReviews = (
  productId: string,
  options: {
    page?: number;
    limit?: number;
    rating?: number;
    sortBy?: 'newest' | 'oldest' | 'helpful' | 'rating_high' | 'rating_low';
  } = {}
) => {
  return useQuery({
    queryKey: ['product-reviews', productId, options],
    queryFn: () => getProductReviews(productId, options),
    enabled: !!productId,
  });
};

export const useProductRatingSummary = (productId: string) => {
  return useQuery({
    queryKey: ['product-rating-summary', productId],
    queryFn: () => getProductRatingSummary(productId),
    enabled: !!productId,
  });
};

export const useCreateReview = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createReview,
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['product-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['product-rating-summary'] });
    },
  });
};

export const useVoteOnReview = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ reviewId, voteType }: { reviewId: string; voteType: 'helpful' | 'not_helpful' }) =>
      voteOnReview(reviewId, voteType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews'] });
    },
  });
};