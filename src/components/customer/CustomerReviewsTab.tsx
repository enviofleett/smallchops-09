import { useState, useEffect } from 'react';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { getCustomerReviews, type ProductReview } from '@/api/reviews';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export const CustomerReviewsTab = () => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const limit = 10;

  const loadReviews = async (pageNum: number, append = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const { reviews: newReviews, total: totalCount } = await getCustomerReviews({
        page: pageNum,
        limit,
      });

      if (append) {
        setReviews(prev => [...prev, ...newReviews]);
      } else {
        setReviews(newReviews);
      }

      setTotal(totalCount);
      setHasMore(newReviews.length === limit && (pageNum * limit) < totalCount);
    } catch (error) {
      console.error('Failed to load customer reviews:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadReviews(1, false);
  }, []);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadReviews(nextPage, true);
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My Reviews</h2>
        <p className="text-sm text-muted-foreground">
          {total} review{total !== 1 ? 's' : ''}
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">You haven't written any reviews yet.</p>
          <p className="text-sm text-muted-foreground">
            Purchase and try our products to share your experience with other customers!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              showProduct={true}
              onVoteUpdate={() => loadReviews(1, false)}
            />
          ))}
        </div>
      )}

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