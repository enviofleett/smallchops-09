import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MOQBadgeProps {
  minimumQuantity: number;
  currentQuantity?: number;
  className?: string;
  showIcon?: boolean;
  variant?: 'default' | 'warning' | 'success';
}

export const MOQBadge = ({ 
  minimumQuantity, 
  currentQuantity, 
  className, 
  showIcon = true,
  variant = 'default' 
}: MOQBadgeProps) => {
  const isViolated = currentQuantity !== undefined && currentQuantity < minimumQuantity;
  const effectiveVariant = isViolated ? 'warning' : variant;

  const getVariantClasses = () => {
    switch (effectiveVariant) {
      case 'warning':
        return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200';
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
    }
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'text-xs font-medium px-2 py-1 flex items-center gap-1',
        getVariantClasses(),
        className
      )}
    >
      {showIcon && (
        isViolated ? (
          <AlertTriangle className="h-3 w-3" />
        ) : (
          <ShoppingCart className="h-3 w-3" />
        )
      )}
      MOQ: {minimumQuantity}
      {currentQuantity !== undefined && (
        <span className={cn(
          'ml-1',
          isViolated ? 'text-orange-600 font-semibold' : 'text-current'
        )}>
          ({currentQuantity}/{minimumQuantity})
        </span>
      )}
    </Badge>
  );
};

interface MOQInfoProps {
  minimumQuantity: number;
  productName?: string;
  className?: string;
}

export const MOQInfo = ({ minimumQuantity, productName, className }: MOQInfoProps) => {
  if (minimumQuantity <= 1) return null;

  return (
    <div className={cn(
      'text-sm text-muted-foreground bg-muted/50 rounded-md p-2 border-l-4 border-blue-500',
      className
    )}>
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-4 w-4 text-blue-500" />
        <span>
          Minimum order: <strong>{minimumQuantity} units</strong>
          {productName && ` for ${productName}`}
        </span>
      </div>
    </div>
  );
};