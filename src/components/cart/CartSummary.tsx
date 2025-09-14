import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckoutFlow } from '@/components/checkout/CheckoutFlow';
import { useCart, Cart } from '@/hooks/useCart';
import { useMOQValidation } from '@/hooks/useMOQValidation';
import { formatCurrency } from '@/lib/formatCurrency';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface CartSummaryProps {
  cart: Cart;
}

export function CartSummary({ cart }: CartSummaryProps) {
  const { validateMOQ } = useMOQValidation();
  const { customerAccount } = useCustomerAuth();
  const [showCheckout, setShowCheckout] = useState(false);

  // Check for MOQ violations
  const moqValidation = validateMOQ(cart.items, cart.items);
  const hasMOQViolations = !moqValidation.isValid;


  return (
    <>
      <Card className="sticky top-6">
        <CardHeader>
          <CardTitle>Cart Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Order Summary with VAT Breakdown */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Sub Total (excl. VAT)</span>
              <span>{formatCurrency(cart.summary.subtotal_cost)}</span>
            </div>

            <div className="flex justify-between text-sm text-muted-foreground">
              <span>VAT (7.5%)</span>
              <span>{formatCurrency(cart.summary.total_vat)}</span>
            </div>

            <div className="flex justify-between text-sm font-medium">
              <span>Sub Total (incl. VAT)</span>
              <span>{formatCurrency(cart.summary.subtotal)}</span>
            </div>


            {/* Delivery costs are calculated at checkout - removed from cart summary */}

            <Separator />

            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span>{formatCurrency(cart.summary.total_amount)}</span>
            </div>

          </div>


          {/* MOQ Violation Warning */}
          {hasMOQViolations && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-orange-800 mb-1">
                    Minimum Order Requirements Not Met
                  </p>
                  <div className="space-y-1 text-orange-700">
                    {moqValidation.violations.map((violation) => (
                      <p key={violation.productId} className="text-xs">
                        • {violation.productName}: {violation.currentQuantity}/{violation.minimumRequired} 
                        (need {violation.shortfall} more)
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Checkout Button - Responsive for all devices */}
          <Button 
            onClick={() => {
              if (hasMOQViolations) {
                toast.error('Please meet minimum order requirements before checkout');
                return;
              }
              console.log('Checkout button clicked, opening checkout flow');
              setShowCheckout(true);
            }} 
            className="w-full"
            size="lg"
            disabled={cart.items.length === 0 || hasMOQViolations}
          >
            <span className="hidden sm:inline">
              {hasMOQViolations ? 'MOQ Requirements Not Met' : `Proceed to Checkout ${formatCurrency(cart.summary.total_amount)}`}
            </span>
            <span className="sm:hidden">
              {hasMOQViolations ? 'MOQ Not Met' : `Checkout ${formatCurrency(cart.summary.total_amount)}`}
            </span>
          </Button>
        </CardContent>
      </Card>

      {/* Checkout Flow */}
      <CheckoutFlow
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
      />
    </>
  );
}