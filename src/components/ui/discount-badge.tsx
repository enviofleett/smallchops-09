import { Badge } from "@/components/ui/badge";
import { calculateDiscountPercentage } from "@/lib/formatPrice";
import { cn } from "@/lib/utils";

interface DiscountBadgeProps {
  discountPercentage: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function DiscountBadge({ 
  discountPercentage, 
  className, 
  size = 'md' 
}: DiscountBadgeProps) {
  if (discountPercentage <= 0) return null;
  
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };
  
  return (
    <Badge 
      variant="destructive" 
      className={cn(
        "bg-red-500 hover:bg-red-600 text-white font-bold",
        sizeClasses[size],
        className
      )}
    >
      {discountPercentage}% OFF
    </Badge>
  );
}