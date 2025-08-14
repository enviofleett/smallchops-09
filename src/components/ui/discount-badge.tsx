import { Badge } from "@/components/ui/badge";
import { formatDiscount } from "@/lib/discountCalculations";
import { cn } from "@/lib/utils";

interface DiscountBadgeProps {
  discountPercentage: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline';
}

export function DiscountBadge({ 
  discountPercentage, 
  className, 
  size = 'md',
  variant = 'default'
}: DiscountBadgeProps) {
  if (discountPercentage <= 0) return null;
  
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const variantClasses = {
    default: "bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground font-bold shadow-sm hover:from-destructive/90 hover:to-destructive/70",
    outline: "border-destructive text-destructive bg-background hover:bg-destructive/10"
  };
  
  return (
    <Badge 
      className={cn(
        variantClasses[variant],
        sizeClasses[size],
        "transition-all duration-200",
        className
      )}
    >
      {formatDiscount(discountPercentage)}
    </Badge>
  );
}