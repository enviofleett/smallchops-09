import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/discountCalculations";
import { applyGlobalDiscount, isGlobalDiscountActive, GLOBAL_DISCOUNT_CONFIG } from "@/config/globalDiscount";
import { Badge } from "@/components/ui/badge";

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
  
  // Check if global discount is active
  const globalDiscountActive = isGlobalDiscountActive();
  
  // Apply global discount if active and no product-specific discount exists
  const finalOriginalPrice = originalPrice;
  const finalDiscountedPrice = globalDiscountActive && !hasDiscount 
    ? applyGlobalDiscount(originalPrice) 
    : discountedPrice;
  const finalHasDiscount = hasDiscount || globalDiscountActive;
  
  const savings = finalHasDiscount && finalDiscountedPrice 
    ? finalOriginalPrice - finalDiscountedPrice 
    : 0;
  
  if (!finalHasDiscount || !finalDiscountedPrice) {
    return (
      <div className={cn("font-semibold text-primary", sizeClasses[size], className)}>
        {formatCurrency(finalOriginalPrice)}
      </div>
    );
  }
  
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("font-bold text-primary", sizeClasses[size])}>
          {formatCurrency(finalDiscountedPrice)}
        </span>
        <span className={cn(
          "text-muted-foreground line-through",
          size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
        )}>
          {formatCurrency(finalOriginalPrice)}
        </span>
        {globalDiscountActive && !hasDiscount && (
          <Badge 
            variant="destructive" 
            className="bg-red-500 hover:bg-red-600 text-white text-xs px-1.5 py-0.5"
          >
            {GLOBAL_DISCOUNT_CONFIG.badgeText}
          </Badge>
        )}
      </div>
      {showSavings && savings > 0 && (
        <div className="text-xs text-green-600 font-medium">
          You save {formatCurrency(savings)}
        </div>
      )}
    </div>
  );
}