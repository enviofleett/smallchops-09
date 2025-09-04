import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { StarRating } from '@/components/ui/star-rating';
import { Badge } from '@/components/ui/badge';
import { ProductRating } from '@/hooks/useProductRatings';

interface ReviewsListProps {
  reviews: ProductRating[];
  onToggleHelpfulness: (reviewId: string, isHelpful: boolean) => void;
  isUpdatingHelpfulness: boolean;
}

export const ReviewsList: React.FC<ReviewsListProps> = ({
  reviews,
  onToggleHelpfulness,
  isUpdatingHelpfulness,
}) => {
  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No reviews yet. Be the first to review this product!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {review.customer_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{review.customer_name}</h4>
                    {review.is_verified_purchase && (
                      <Badge variant="secondary" className="text-xs">
                        Verified Purchase
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRating rating={review.rating} size="sm" />
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {review.content && (
              <p className="text-foreground mb-4 leading-relaxed">
                {review.content}
              </p>
            )}
            
            {review.helpful_votes > 0 && (
              <div className="text-xs text-muted-foreground">
                {review.helpful_votes} people found this helpful
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};