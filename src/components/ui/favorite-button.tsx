import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  isFavorite: boolean;
  isLoading?: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const FavoriteButton = ({ 
  isFavorite, 
  isLoading = false, 
  onToggle, 
  size = 'md',
  className 
}: FavoriteButtonProps) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8', 
    lg: 'h-10 w-10'
  };

  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        sizeClasses[size],
        'rounded-full hover:bg-accent/10 transition-colors',
        className
      )}
      onClick={onToggle}
      disabled={isLoading}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart
        size={iconSizes[size]}
        className={cn(
          'transition-colors',
          isFavorite 
            ? 'fill-red-500 text-red-500' 
            : 'text-muted-foreground hover:text-red-500',
          isLoading && 'opacity-50'
        )}
      />
    </Button>
  );
};