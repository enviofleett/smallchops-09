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
    <div
      className={cn(
        "rounded-lg border bg-card/80 p-3 sm:p-4 w-full max-w-md",
        {
          "border-green-200 bg-green-50/60": statusColor === 'success',
          "border-amber-200 bg-amber-50/60": statusColor === 'warning',
          "border-red-200 bg-red-50/60": statusColor === 'destructive'
        },
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center",
              {
                "bg-green-100 text-green-600": statusColor === 'success',
                "bg-amber-100 text-amber-600": statusColor === 'warning',
                "bg-red-100 text-red-600": statusColor === 'destructive'
              }
            )}
          >
            <ShoppingCart className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">
              Minimum order: {minimumOrderQuantity} units
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Order at least this quantity to complete checkout
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            MOQ total
          </div>
          <div className="text-sm font-semibold text-foreground">
            {formatCurrency(minimumCost)}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {currentCartQuantity > 0 && (
          <div className="flex items-center justify-between text-[11px] sm:text-xs">
            <span className="text-muted-foreground">In cart</span>
            <span
              className={cn(
                "font-medium",
                {
                  "text-green-600": statusColor === 'success',
                  "text-amber-600": statusColor === 'warning',
                  "text-red-600": statusColor === 'destructive'
                }
              )}
            >
              {currentCartQuantity} / {minimumOrderQuantity}
            </span>
          </div>
        )}

        {!isStockSufficient ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-red-100 text-red-700 text-[11px] sm:text-xs">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span>Insufficient stock for the minimum order</span>
          </div>
        ) : !isCurrentlyMet ? (
          <div className="flex items-center justify-between px-2 py-1.5 rounded-full bg-amber-100 text-amber-700 text-[11px] sm:text-xs">
            <span>Need {shortfall} more</span>
            <span className="font-medium">+{formatCurrency(shortfall * price)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-green-100 text-green-600 text-[11px] sm:text-xs">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
            <span>MOQ requirement met</span>
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
