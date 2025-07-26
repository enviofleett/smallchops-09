import { StarRating } from '@/components/ui/star-rating';
import { Progress } from '@/components/ui/progress';
import type { ProductRatingSummary } from '@/api/reviews';

interface ProductRatingsSummaryProps {
  summary: ProductRatingSummary | null;
  className?: string;
}

export const ProductRatingsSummary = ({ summary, className }: ProductRatingsSummaryProps) => {
  if (!summary || summary.total_reviews === 0) {
    return (
      <div className={className}>
        <p className="text-muted-foreground">No reviews yet</p>
      </div>
    );
  }

  const ratingDistribution = summary.rating_distribution as Record<string, number>;
  const ratings = [5, 4, 3, 2, 1];

  return (
    <div className={className}>
      <div className="flex items-center gap-4 mb-4">
        <div className="text-center">
          <div className="text-3xl font-bold">{summary.average_rating.toFixed(1)}</div>
          <StarRating rating={summary.average_rating} size="lg" />
          <p className="text-sm text-muted-foreground mt-1">
            {summary.total_reviews} review{summary.total_reviews !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex-1 space-y-2">
          {ratings.map((rating) => {
            const count = ratingDistribution[rating.toString()] || 0;
            const percentage = summary.total_reviews > 0 ? (count / summary.total_reviews) * 100 : 0;
            
            return (
              <div key={rating} className="flex items-center gap-2 text-sm">
                <span className="w-8">{rating}</span>
                <StarRating rating={1} maxRating={1} size="sm" />
                <Progress value={percentage} className="flex-1 h-2" />
                <span className="w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};