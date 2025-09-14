import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/formatPrice";

interface PriceDisplayProps {
  originalPrice: number;
  discountedPrice?: number;
  hasDiscount?: boolean;
  className?: string;
  showSavings?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function PriceDisplay({ 
  originalPrice, 
  discountedPrice, 
  hasDiscount = false, 
  className,
  showSavings = false,
  size = 'md'
}: PriceDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };
  
  const savings = hasDiscount && discountedPrice ? originalPrice - discountedPrice : 0;
  
  if (!hasDiscount || !discountedPrice) {
    return (
      <div className={cn("font-semibold text-primary", sizeClasses[size], className)}>
        {formatPrice(originalPrice)}
      </div>
    );
  }
  
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <span className={cn("font-bold text-primary", sizeClasses[size])}>
          {formatPrice(discountedPrice)}
        </span>
        <span className={cn(
          "text-muted-foreground line-through",
          size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
        )}>
          {formatPrice(originalPrice)}
        </span>
      </div>
      {showSavings && savings > 0 && (
        <div className="text-xs text-green-600 font-medium">
          You save {formatPrice(savings)}
        </div>
      )}
    </div>
  );
}