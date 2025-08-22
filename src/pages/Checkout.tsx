import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { CheckoutFlow } from '@/components/checkout/CheckoutFlow';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Checkout() {
  const navigate = useNavigate();
  const { cart } = useCart();

  // Redirect to cart if empty
  useEffect(() => {
    if (cart.itemCount === 0) {
      console.log('🛒 Checkout: Cart is empty, redirecting to cart page');
      navigate('/cart', { replace: true });
    }
  }, [cart.itemCount, navigate]);

  // Log checkout page access for debugging
  useEffect(() => {
    console.log('🛒 Checkout Page: Accessed with cart:', {
      itemCount: cart.itemCount,
      total: cart.summary.total,
      items: cart.items.length
    });
  }, [cart]);

  // Show loading state while checking cart
  if (cart.itemCount === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <ShoppingBag className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 text-center mb-4">
                  Checking your cart...
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      
      <div className="container mx-auto px-4 py-6">
        {/* Header with back button */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/cart')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cart
          </Button>
          
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-6 w-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Checkout
            </h1>
          </div>
          
          <p className="text-gray-600 mt-2">
            Complete your order with {cart.itemCount} item{cart.itemCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Checkout Flow */}
        <div className="max-w-4xl mx-auto">
          <CheckoutFlow />
        </div>
      </div>
      
      <PublicFooter />
    </div>
  );
}
