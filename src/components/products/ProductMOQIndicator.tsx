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
  showDetailedInfo?: boolean;
  variant?: 'compact' | 'detailed' | 'inline';
}

export const ProductMOQIndicator = ({
  minimumOrderQuantity,
  price,
  stockQuantity,
  currentCartQuantity = 0,
  className,
  showDetailedInfo = false,
  variant = 'compact'
}: ProductMOQIndicatorProps) => {
  // Don't show if MOQ is 1 or less or if required data is missing
  if (!minimumOrderQuantity || minimumOrderQuantity <= 1 || !price) return null;

  const isStockSufficient = !stockQuantity || stockQuantity >= minimumOrderQuantity;
  const isCurrentlyMet = currentCartQuantity >= minimumOrderQuantity;
  const shortfall = Math.max(0, minimumOrderQuantity - currentCartQuantity);
  const minimumCost = minimumOrderQuantity * price;
  const additionalCostNeeded = shortfall * price;

  const getVariantDisplay = () => {
    switch (variant) {
      case 'inline':
        return (
          <Badge 
            variant={isCurrentlyMet ? "default" : "secondary"} 
            className={cn(
              "text-xs sm:text-sm inline-flex items-center gap-1 flex-wrap",
              isCurrentlyMet ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800",
              className
            )}
          >
            <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">MOQ: {minimumOrderQuantity}</span>
            {currentCartQuantity > 0 && (
              <span className={cn(
                "ml-1 whitespace-nowrap",
                isCurrentlyMet ? "text-green-700" : "text-orange-600"
              )}>
                ({currentCartQuantity}/{minimumOrderQuantity})
              </span>
            )}
          </Badge>
        );

      case 'detailed':
        return (
          <Alert className={cn(
            "border-l-4 w-full",
            isStockSufficient 
              ? isCurrentlyMet 
                ? "border-green-500 bg-green-50" 
                : "border-blue-500 bg-blue-50"
              : "border-red-500 bg-red-50",
            className
          )}>
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <AlertDescription>
              <div className="space-y-3 sm:space-y-4">
                <div className="font-medium text-sm sm:text-base">
                  Minimum Order: {minimumOrderQuantity} units
                </div>
                
                {/* Responsive grid - stack on mobile, 2 columns on larger screens */}
                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div className="space-y-1">
                    <span className="text-gray-600 block">Minimum Cost:</span>
                    <div className="font-medium text-sm sm:text-base">{formatCurrency(minimumCost)}</div>
                  </div>
                  
                  {currentCartQuantity > 0 && (
                    <div className="space-y-1">
                      <span className="text-gray-600 block">In Cart:</span>
                      <div className={cn(
                        "font-medium text-sm sm:text-base",
                        isCurrentlyMet ? "text-green-600" : "text-orange-600"
                      )}>
                        {currentCartQuantity} units
                      </div>
                    </div>
                  )}
                </div>

                {!isCurrentlyMet && shortfall > 0 && (
                  <div className="pt-2 sm:pt-3 border-t border-gray-200">
                    <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                      <div>Need {shortfall} more units</div>
                      {additionalCostNeeded > 0 && (
                        <div className="font-medium text-orange-600">
                          Additional cost: {formatCurrency(additionalCostNeeded)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!isStockSufficient && (
                  <div className="flex items-start gap-2 text-red-600 text-xs sm:text-sm bg-red-100 p-2 rounded">
                    <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5" />
                    <span>Insufficient stock available to meet minimum order quantity</span>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        );

      default: // compact
        return (
          <div className={cn("flex flex-col sm:flex-row sm:items-center gap-2 w-full", className)}>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs sm:text-sm w-fit flex-shrink-0",
                isCurrentlyMet 
                  ? "bg-green-100 text-green-800 border-green-300"
                  : "bg-blue-100 text-blue-800 border-blue-300"
              )}
            >
              <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
              <span className="whitespace-nowrap">MOQ: {minimumOrderQuantity}</span>
            </Badge>
            
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              {currentCartQuantity > 0 && (
                <span className={cn(
                  "font-medium whitespace-nowrap",
                  isCurrentlyMet ? "text-green-600" : "text-orange-600"
                )}>
                  In cart: {currentCartQuantity}/{minimumOrderQuantity}
                </span>
              )}
              
              {showDetailedInfo && (
                <span className="text-gray-500 whitespace-nowrap">
                  Min: {formatCurrency(minimumCost)}
                </span>
              )}
            </div>
          </div>
        );
    }
  };

  return getVariantDisplay();
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
    <Alert variant="destructive" className={cn("bg-orange-50 border-orange-200 w-full", className)}>
      <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
      <AlertDescription className="text-orange-800">
        <div className="space-y-2 sm:space-y-3">
          <div className="font-medium text-sm sm:text-base">
            Minimum Order Quantity Not Met
          </div>
          <div className="text-xs sm:text-sm space-y-1">
            <div>
              {productName} requires a minimum order of {minimumOrderQuantity} units.
            </div>
            <div>
              You currently have {currentCartQuantity} in your cart.
            </div>
          </div>
          <div className="text-xs sm:text-sm font-medium text-orange-700">
            Add {shortfall} more units ({formatCurrency(additionalCost)}) to meet the minimum requirement.
          </div>
          {onAddToCart && (
            <button
              onClick={() => onAddToCart(shortfall)}
              className="text-xs sm:text-sm underline hover:no-underline font-medium mt-2 p-1 rounded hover:bg-orange-100 transition-colors"
            >
              Add {shortfall} more to cart
            </button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};