import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  className?: string;
  setHoverRating?: (rating: number) => void;
}

export const StarRating = ({
  rating,
  maxRating = 5,
  size = 'md',
  interactive = false,
  onRatingChange,
  className,
  setHoverRating,
}: StarRatingProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const handleStarClick = (starRating: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(starRating);
    }
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: maxRating }, (_, index) => {
        const starRating = index + 1;
        const isFilled = starRating <= rating;
        const isPartial = rating > index && rating < starRating;

        return (
          <Star
            key={index}
            className={cn(
              sizeClasses[size],
              'transition-colors duration-200',
              {
                'text-yellow-400 fill-yellow-400': isFilled,
                'text-yellow-200 fill-yellow-200': isPartial,
                'text-muted-foreground': !isFilled && !isPartial,
                'cursor-pointer hover:text-yellow-300 hover:scale-110': interactive,
              }
            )}
            onClick={() => handleStarClick(starRating)}
            onMouseEnter={() => interactive && setHoverRating?.(starRating)}
            onMouseLeave={() => interactive && setHoverRating?.(0)}
          />
        );
      })}
      {rating > 0 && !interactive && (
        <span className="text-sm text-muted-foreground ml-1">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};