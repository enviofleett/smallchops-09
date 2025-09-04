import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShoppingCart, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/discountCalculations';

interface ProductMOQIndicatorProps {
  minimumOrderQuantity: number;
  price: number;
  stockQuantity?: number;
  currentCartQuantity?: number;
  className?: string;
}

export const ProductMOQIndicator = ({
  minimumOrderQuantity,
  price,
  stockQuantity,
  currentCartQuantity = 0,
  className
}: ProductMOQIndicatorProps) => {
  // Don't show if MOQ is 1 or less or if required data is missing
  if (!minimumOrderQuantity || minimumOrderQuantity <= 1 || !price) return null;

  const isStockSufficient = !stockQuantity || stockQuantity >= minimumOrderQuantity;
  const isCurrentlyMet = currentCartQuantity >= minimumOrderQuantity;
  const shortfall = Math.max(0, minimumOrderQuantity - currentCartQuantity);
  const minimumCost = minimumOrderQuantity * price;

  // Determine status for styling
  const getStatusColor = () => {
    if (!isStockSufficient) return 'destructive';
    if (isCurrentlyMet) return 'success';
    return 'warning';
  };

  const statusColor = getStatusColor();

  return (
    <div className={cn(
      "rounded-md border bg-card p-3 w-full",
      "border-l-4",
      {
        "border-l-green-500 bg-green-50/30 border-green-200": statusColor === 'success',
        "border-l-amber-500 bg-amber-50/30 border-amber-200": statusColor === 'warning',
        "border-l-red-500 bg-red-50/30 border-red-200": statusColor === 'destructive'
      },
      className
    )}>
      {/* Compact Header with Status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1 rounded",
            {
              "bg-green-100 text-green-600": statusColor === 'success',
              "bg-amber-100 text-amber-600": statusColor === 'warning',
              "bg-red-100 text-red-600": statusColor === 'destructive'
            }
          )}>
            <ShoppingCart className="h-3 w-3" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Min Order: {minimumOrderQuantity} units
          </span>
        </div>
        
        <span className="text-xs font-semibold text-foreground">
          {formatCurrency(minimumCost)}
        </span>
      </div>

      {/* Compact Status Bar */}
      <div className="space-y-1.5">
        {currentCartQuantity > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">In Cart:</span>
            <span className={cn(
              "font-medium",
              {
                "text-green-600": statusColor === 'success',
                "text-amber-600": statusColor === 'warning', 
                "text-red-600": statusColor === 'destructive'
              }
            )}>
              {currentCartQuantity} / {minimumOrderQuantity}
            </span>
          </div>
        )}

        {/* Single Status Message */}
        {!isStockSufficient ? (
          <div className="flex items-center gap-1.5 p-1.5 rounded bg-red-100 text-red-700 text-xs">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span>Insufficient stock</span>
          </div>
        ) : !isCurrentlyMet ? (
          <div className="flex items-center justify-between p-1.5 rounded bg-amber-100 text-amber-700 text-xs">
            <span>Need {shortfall} more</span>
            <span className="font-medium">+{formatCurrency(shortfall * price)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 p-1.5 rounded bg-green-100 text-green-600 text-xs">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
            <span>Requirement met</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface ProductMOQWarningProps {
  minimumOrderQuantity: number;
  currentCartQuantity: number;
  productName: string;
  price: number;
  onAddToCart?: (quantity: number) => void;
  className?: string;
}

export const ProductMOQWarning = ({
  minimumOrderQuantity,
  currentCartQuantity,
  productName,
  price,
  onAddToCart,
  className
}: ProductMOQWarningProps) => {
  if (currentCartQuantity >= minimumOrderQuantity) return null;

  const shortfall = minimumOrderQuantity - currentCartQuantity;
  const additionalCost = shortfall * price;

  return (
    <div className={cn(
      "rounded-lg border border-amber-200 bg-amber-50/50 p-4 w-full",
      "border-l-4 border-l-amber-500",
      className
    )}>
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
          <AlertTriangle className="h-4 w-4" />
        </div>
        
        <div className="flex-1 space-y-2">
          <div className="font-medium text-sm text-amber-800">
            Minimum Order Quantity Not Met
          </div>
          
          <div className="text-sm text-amber-700 space-y-1">
            <p>{productName} requires a minimum order of <span className="font-medium">{minimumOrderQuantity} units</span>.</p>
            <p>You currently have <span className="font-medium">{currentCartQuantity} units</span> in your cart.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-amber-200">
            <span className="text-sm font-medium text-amber-800">
              Need {shortfall} more units • {formatCurrency(additionalCost)}
            </span>
            
            {onAddToCart && (
              <button
                onClick={() => onAddToCart(shortfall)}
                className="px-3 py-1.5 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors duration-200 w-fit"
              >
                Add {shortfall} to cart
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};