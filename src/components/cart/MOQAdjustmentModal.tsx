import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShoppingCart, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/discountCalculations';

interface MOQAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  adjustments: {
    productId: string;
    productName: string;
    originalQuantity: number;
    adjustedQuantity: number;
    additionalCost: number;
  }[];
  pricingImpact?: {
    originalTotal: number;
    adjustedTotal: number;
    additionalCost: number;
    impactPercentage: number;
  };
}

export const MOQAdjustmentModal = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  adjustments,
  pricingImpact
}: MOQAdjustmentModalProps) => {
  const totalAdditionalCost = adjustments.reduce((sum, adj) => sum + adj.additionalCost, 0);
  const totalAdditionalItems = adjustments.reduce((sum, adj) => sum + (adj.adjustedQuantity - adj.originalQuantity), 0);

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            Minimum Order Quantity Adjustments Required
          </DialogTitle>
          <DialogDescription>
            Some products in your cart don't meet their minimum order quantities. 
            We can automatically adjust the quantities to proceed with your order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Adjustments List */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-700">Required Adjustments:</h4>
            {adjustments.map((adjustment) => (
              <div key={adjustment.productId} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{adjustment.productName}</span>
                  <Badge variant="outline" className="text-xs">
                    MOQ Adjustment
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Current:</span>
                    <div className="font-medium">{adjustment.originalQuantity} items</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Required:</span>
                    <div className="font-medium text-blue-600">
                      {adjustment.adjustedQuantity} items
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Additional Cost:</span>
                    <div className="font-medium text-green-600">
                      {formatCurrency(adjustment.additionalCost)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Alert */}
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium">Order Summary Impact:</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Additional Items:</span>
                    <span className="ml-2 font-medium">+{totalAdditionalItems}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Additional Cost:</span>
                    <span className="ml-2 font-medium text-green-600">
                      {formatCurrency(totalAdditionalCost)}
                    </span>
                  </div>
                </div>
                
                {pricingImpact && (
                  <div className="pt-2 border-t">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Original Total:</span>
                        <span className="ml-2">{formatCurrency(pricingImpact.originalTotal)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">New Total:</span>
                        <span className="ml-2 font-medium">
                          {formatCurrency(pricingImpact.adjustedTotal)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Price increase: {pricingImpact.impactPercentage.toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Warning */}
          <Alert variant="destructive" className="bg-orange-50 border-orange-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-orange-800">
              If you decline these adjustments, you won't be able to proceed with checkout 
              until the minimum order quantities are met manually.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="flex-1 sm:flex-none"
          >
            Cancel & Edit Manually
          </Button>
          <Button 
            onClick={handleConfirm}
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700"
          >
            Accept Adjustments ({formatCurrency(totalAdditionalCost)})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};