import React from 'react';
import { Progress } from '@/components/ui/progress';
import { StarRating } from '@/components/ui/star-rating';
import { RatingSummary } from '@/hooks/useProductRatings';

interface RatingSummaryProps {
  summary: RatingSummary;
}

export const RatingSummaryComponent: React.FC<RatingSummaryProps> = ({ summary }) => {
  const getRatingPercentage = (count: number) => {
    return summary.total_reviews > 0 ? (count / summary.total_reviews) * 100 : 0;
  };

  const ratingCounts = [
    { stars: 5, count: summary.rating_distribution[5] || 0 },
    { stars: 4, count: summary.rating_distribution[4] || 0 },
    { stars: 3, count: summary.rating_distribution[3] || 0 },
    { stars: 2, count: summary.rating_distribution[2] || 0 },
    { stars: 1, count: summary.rating_distribution[1] || 0 },
  ];

  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex items-center gap-6 mb-6">
        <div className="text-center">
          <div className="text-4xl font-bold mb-2">
            {summary.average_rating.toFixed(1)}
          </div>
          <StarRating rating={summary.average_rating} size="md" />
          <p className="text-sm text-muted-foreground mt-2">
            Based on {summary.total_reviews} review{summary.total_reviews !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex-1 space-y-2">
          {ratingCounts.map(({ stars, count }) => (
            <div key={stars} className="flex items-center gap-3">
              <span className="text-sm font-medium w-3">{stars}</span>
              <div className="flex-1">
                <Progress 
                  value={getRatingPercentage(count)} 
                  className="h-2"
                />
              </div>
              <span className="text-sm text-muted-foreground w-8">
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};