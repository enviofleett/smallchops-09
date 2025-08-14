import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/discountCalculations";

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
        {formatCurrency(originalPrice)}
      </div>
    );
  }
  
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <span className={cn("font-bold text-primary", sizeClasses[size])}>
          {formatCurrency(discountedPrice)}
        </span>
        <span className={cn(
          "text-muted-foreground line-through",
          size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
        )}>
          {formatCurrency(originalPrice)}
        </span>
      </div>
      {showSavings && savings > 0 && (
        <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          You save {formatCurrency(savings)}
        </div>
      )}
    </div>
  );
}