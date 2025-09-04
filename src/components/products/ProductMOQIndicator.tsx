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
              "text-xs inline-flex items-center gap-1",
              isCurrentlyMet ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800",
              className
            )}
          >
            <ShoppingCart className="h-3 w-3" />
            MOQ: {minimumOrderQuantity}
            {currentCartQuantity > 0 && (
              <span className={cn(
                "ml-1",
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
            "border-l-4",
            isStockSufficient 
              ? isCurrentlyMet 
                ? "border-green-500 bg-green-50" 
                : "border-blue-500 bg-blue-50"
              : "border-red-500 bg-red-50",
            className
          )}>
            <ShoppingCart className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium text-sm">
                  Minimum Order: {minimumOrderQuantity} units
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-600">Minimum Cost:</span>
                    <div className="font-medium">{formatCurrency(minimumCost)}</div>
                  </div>
                  
                  {currentCartQuantity > 0 && (
                    <div>
                      <span className="text-gray-600">In Cart:</span>
                      <div className={cn(
                        "font-medium",
                        isCurrentlyMet ? "text-green-600" : "text-orange-600"
                      )}>
                        {currentCartQuantity} units
                      </div>
                    </div>
                  )}
                </div>

                {!isCurrentlyMet && shortfall > 0 && (
                  <div className="pt-2 border-t border-gray-200">
                    <div className="text-xs text-gray-600">
                      Need {shortfall} more units
                      {additionalCostNeeded > 0 && (
                        <span className="ml-1">
                          (+ {formatCurrency(additionalCostNeeded)})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {!isStockSufficient && (
                  <div className="flex items-center gap-1 text-red-600 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    Insufficient stock for MOQ
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        );

      default: // compact
        return (
          <div className={cn("flex items-center gap-2", className)}>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                isCurrentlyMet 
                  ? "bg-green-100 text-green-800 border-green-300"
                  : "bg-blue-100 text-blue-800 border-blue-300"
              )}
            >
              <ShoppingCart className="h-3 w-3 mr-1" />
              MOQ: {minimumOrderQuantity}
            </Badge>
            
            {currentCartQuantity > 0 && (
              <span className={cn(
                "text-xs font-medium",
                isCurrentlyMet ? "text-green-600" : "text-orange-600"
              )}>
                {currentCartQuantity}/{minimumOrderQuantity}
              </span>
            )}
            
            {showDetailedInfo && (
              <span className="text-xs text-gray-500">
                Min: {formatCurrency(minimumCost)}
              </span>
            )}
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
    <Alert variant="destructive" className={cn("bg-orange-50 border-orange-200", className)}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="text-orange-800">
        <div className="space-y-2">
          <div className="font-medium text-sm">
            Minimum Order Quantity Not Met
          </div>
          <div className="text-xs">
            {productName} requires a minimum order of {minimumOrderQuantity} units. 
            You currently have {currentCartQuantity} in your cart.
          </div>
          <div className="text-xs">
            Add {shortfall} more units ({formatCurrency(additionalCost)}) to meet the minimum requirement.
          </div>
          {onAddToCart && (
            <button
              onClick={() => onAddToCart(shortfall)}
              className="text-xs underline hover:no-underline font-medium mt-1"
            >
              Add {shortfall} more to cart
            </button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};