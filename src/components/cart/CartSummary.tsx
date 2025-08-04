import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CheckoutFlow } from '@/components/checkout/CheckoutFlow';
import { useCart, Cart } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/discountCalculations';
import { Tag, X, Gift, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CartSummaryProps {
  cart: Cart;
}

export function CartSummary({ cart }: CartSummaryProps) {
  const { applyPromotionCode, removePromotionCode } = useCart();
  const [showCheckout, setShowCheckout] = useState(false);
  const [promotionCode, setPromotionCode] = useState('');
  const [isApplyingPromotion, setIsApplyingPromotion] = useState(false);

  const handleApplyPromotionCode = async () => {
    if (!promotionCode.trim()) {
      toast.error('Please enter a promotion code');
      return;
    }

    setIsApplyingPromotion(true);
    try {
      const result = await applyPromotionCode(promotionCode.trim());
      if (result.success) {
        toast.success(result.message);
        setPromotionCode('');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to apply promotion code');
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
                Promo Code
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter code"
                  value={promotionCode}
                  onChange={(e) => setPromotionCode(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleApplyPromotionCode()}
                  className="text-sm"
                />
                <Button 
                  onClick={handleApplyPromotionCode} 
                  disabled={isApplyingPromotion || !promotionCode.trim()}
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

            <div className="flex justify-between text-sm">
              <span>Delivery</span>
              <span className={cart.summary.delivery_discount > 0 ? 'line-through text-muted-foreground' : ''}>
                {cart.summary.delivery_fee > 0 ? formatCurrency(cart.summary.delivery_fee) : 'Free'}
              </span>
            </div>

            {cart.summary.delivery_discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Delivery Discount</span>
                <span>-{formatCurrency(cart.summary.delivery_discount)}</span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span>{formatCurrency(cart.summary.total_amount)}</span>
            </div>

            {/* Tax Summary Box */}
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Tax Breakdown</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Items VAT:</span>
                  <span>{formatCurrency(cart.summary.total_vat)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Total VAT Inclusive:</span>
                  <span className="font-medium">{formatCurrency(cart.summary.total_vat)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* BOGO Items Display */}
          {cart.summary.applied_promotions.some(p => p.bogo_items?.length) && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-sm text-green-800 mb-2">Free Items (BOGO):</h4>
              {cart.summary.applied_promotions
                .filter(p => p.bogo_items?.length)
                .map(promotion => 
                  promotion.bogo_items?.map(item => (
                    <div key={`${promotion.id}-${item.product_id}`} className="flex justify-between text-sm text-green-700">
                      <span>{item.product_name} x{item.free_quantity}</span>
                      <span className="font-medium">FREE!</span>
                    </div>
                  ))
                )}
            </div>
          )}

          {/* Checkout Button */}
          <Button 
            onClick={() => {
              console.log('Checkout button clicked, opening checkout flow');
              setShowCheckout(true);
            }} 
            className="w-full"
            size="lg"
            disabled={cart.items.length === 0}
          >
            Proceed to Checkout {formatCurrency(cart.summary.total_amount)}
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