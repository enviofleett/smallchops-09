import React from 'react';
import { Badge } from './badge';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromotionalBadgeProps {
  className?: string;
  variant?: 'default' | 'outline' | 'secondary';
}

export const PromotionalBadge = ({ className, variant = 'default' }: PromotionalBadgeProps) => {
  return (
    <Badge 
      variant={variant} 
      className={cn(
        "bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 font-semibold shadow-md",
        "hover:from-orange-600 hover:to-red-600 transition-all duration-200",
        className
      )}
    >
      <Star className="w-3 h-3 mr-1 fill-current" />
      Promotional
    </Badge>
  );
};