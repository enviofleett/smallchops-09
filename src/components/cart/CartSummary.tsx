import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CheckoutFlow } from '@/components/checkout/CheckoutFlow';
import { useCart, Cart } from '@/hooks/useCart';
import { useMOQValidation } from '@/hooks/useMOQValidation';
import { formatCurrency } from '@/lib/discountCalculations';
import { validatePromotionCode } from '@/api/promotionValidation';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Tag, X, Gift, Loader2, AlertTriangle, Clock, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface CartSummaryProps {
  cart: Cart;
}

export function CartSummary({ cart }: CartSummaryProps) {
  const { applyPromotionCode, removePromotionCode } = useCart();
  const { validateMOQ } = useMOQValidation();
  const { customerAccount } = useCustomerAuth();
  const [showCheckout, setShowCheckout] = useState(false);
  const [promotionCode, setPromotionCode] = useState('');
  const [isApplyingPromotion, setIsApplyingPromotion] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    attempts_remaining?: number;
    blocked_until?: string;
  }>({});

  // Check for MOQ violations
  const moqValidation = validateMOQ(cart.items, cart.items);
  const hasMOQViolations = !moqValidation.isValid;

  const handleApplyPromotionCode = async () => {
    if (!promotionCode.trim()) {
      toast.error('Please enter a promotion code');
      return;
    }

    setIsApplyingPromotion(true);
    try {
      // Use the enhanced validation with rate limiting
      const result = await validatePromotionCode(
        promotionCode.trim(),
        cart.summary.subtotal,
        customerAccount?.email,
        customerAccount?.id,
        cart.items
      );

      // Update rate limit info
      setRateLimitInfo({
        attempts_remaining: result.attempts_remaining,
        blocked_until: result.rate_limited ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : undefined
      });

      if (result.valid && result.promotion) {
        // Apply the promotion using the existing cart logic
        const applyResult = await applyPromotionCode(promotionCode.trim());
        
        if (applyResult.success) {
          toast.success('🎉 ' + (result.promotion.name || 'Promotion applied successfully!'), {
            description: result.discount_amount ? `You saved ${formatCurrency(result.discount_amount)}` : undefined
          });
          setPromotionCode('');
          setRateLimitInfo({ attempts_remaining: result.attempts_remaining });
        } else {
          toast.error(applyResult.message || 'Failed to apply promotion');
        }
      } else {
        // Show specific error messages
        if (result.rate_limited) {
          toast.error('🚫 Too many attempts', {
            description: result.error,
            duration: 5000
          });
        } else {
          toast.error(result.error || 'Invalid promotion code');
        }
      }
    } catch (error) {
      console.error('Promotion application error:', error);
      toast.error('Failed to apply promotion code. Please try again.');
    } finally {
      setIsApplyingPromotion(false);
    }
  };

  const handleRemovePromotion = () => {
    removePromotionCode();
    toast.success('Promotion removed');
  };

  return (
    <>
      <Card className="sticky top-6">
        <CardHeader>
          <CardTitle>Cart Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Promotion Code Section */}
          {cart.summary.applied_promotions.length > 0 ? (
            <div className="space-y-2">
              {cart.summary.applied_promotions.map((promotion) => (
                <div key={promotion.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800 text-sm">{promotion.name}</p>
                      {promotion.code && (
                        <p className="text-xs text-green-600">Code: {promotion.code}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemovePromotion}
                    className="text-red-600 hover:text-red-700 h-auto p-1"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Tag className="w-4 h-4" />
                <span>Promo Code</span>
                {rateLimitInfo.attempts_remaining !== undefined && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    <Shield className="w-3 h-3 mr-1" />
                    {rateLimitInfo.attempts_remaining} attempts left
                  </Badge>
                )}
              </div>
              
              {rateLimitInfo.blocked_until && new Date(rateLimitInfo.blocked_until) > new Date() && (
                <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                  <Clock className="w-3 h-3" />
                  <span>Too many attempts. Try again in 15 minutes.</span>
                </div>
              )}
              
              <div className="flex gap-2">
                <Input
                  placeholder="Enter code"
                  value={promotionCode}
                  onChange={(e) => setPromotionCode(e.target.value.toUpperCase())}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !isApplyingPromotion) {
                      handleApplyPromotionCode();
                    }
                  }}
                  className="text-sm"
                  disabled={isApplyingPromotion || (rateLimitInfo.blocked_until && new Date(rateLimitInfo.blocked_until) > new Date())}
                  maxLength={20}
                />
                <Button 
                  onClick={handleApplyPromotionCode} 
                  disabled={
                    isApplyingPromotion || 
                    !promotionCode.trim() || 
                    (rateLimitInfo.blocked_until && new Date(rateLimitInfo.blocked_until) > new Date()) ||
                    rateLimitInfo.attempts_remaining === 0
                  }
                  variant="outline"
                  size="sm"
                >
                  {isApplyingPromotion ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Apply'
                  )}
                </Button>
              </div>
              
              {rateLimitInfo.attempts_remaining === 0 && !rateLimitInfo.blocked_until && (
                <div className="text-xs text-muted-foreground">
                  No more attempts available this hour. Please try again later.
                </div>
              )}
            </div>
          )}

          <Separator />

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

            {cart.summary.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(cart.summary.discount_amount)}</span>
              </div>
            )}

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
            data-checkout-button
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