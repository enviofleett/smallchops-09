import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReviewCard } from './ReviewCard';
import { getProductReviews, type ProductReview } from '@/api/reviews';
import { Skeleton } from '@/components/ui/skeleton';

interface ReviewsListProps {
  productId: string;
  onReviewsChange?: (count: number) => void;
}

type SortOption = 'newest' | 'oldest' | 'helpful' | 'rating_high' | 'rating_low';
type RatingFilter = 'all' | '5' | '4' | '3' | '2' | '1';

export const ReviewsList = ({ productId, onReviewsChange }: ReviewsListProps) => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');

  const limit = 10;

  const loadReviews = async (pageNum: number, append = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const options = {
        page: pageNum,
        limit,
        sortBy,
        ...(ratingFilter !== 'all' && { rating: parseInt(ratingFilter) }),
      };

      const { reviews: newReviews, total: totalCount } = await getProductReviews(productId, options);

      if (append) {
        setReviews(prev => [...prev, ...newReviews]);
      } else {
        setReviews(newReviews);
      }

      setTotal(totalCount);
      setHasMore(newReviews.length === limit && (pageNum * limit) < totalCount);
      onReviewsChange?.(totalCount);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadReviews(1, false);
  }, [productId, sortBy, ratingFilter]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadReviews(nextPage, true);
  };

  const handleFilterChange = (newSortBy: SortOption, newRatingFilter: RatingFilter) => {
    setSortBy(newSortBy);
    setRatingFilter(newRatingFilter);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Sort by:</span>
          <Select value={sortBy} onValueChange={(value: SortOption) => handleFilterChange(value, ratingFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="helpful">Most Helpful</SelectItem>
              <SelectItem value="rating_high">Highest Rating</SelectItem>
              <SelectItem value="rating_low">Lowest Rating</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Rating:</span>
          <Select value={ratingFilter} onValueChange={(value: RatingFilter) => handleFilterChange(sortBy, value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="5">5 Stars</SelectItem>
              <SelectItem value="4">4 Stars</SelectItem>
              <SelectItem value="3">3 Stars</SelectItem>
              <SelectItem value="2">2 Stars</SelectItem>
              <SelectItem value="1">1 Star</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto text-sm text-muted-foreground">
          {total} review{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Reviews */}
      {reviews.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            {ratingFilter === 'all' ? 'No reviews yet.' : `No ${ratingFilter}-star reviews found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onVoteUpdate={() => loadReviews(1, false)}
            />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load More Reviews'}
          </Button>
        </div>
      )}
    </div>
  );
};