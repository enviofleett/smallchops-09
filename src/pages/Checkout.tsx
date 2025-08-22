import React, { useState } from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { EnhancedCheckoutFlow } from '@/components/checkout/EnhancedCheckoutFlow';
import { useCart } from '@/hooks/useCart';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBag, ArrowLeft } from 'lucide-react';

const Checkout = () => {
  const { cart } = useCart();
  const navigate = useNavigate();
  const [checkoutOpen, setCheckoutOpen] = useState(true);

  useEffect(() => {
    // Redirect to cart if no items
    if (!cart.items || cart.items.length === 0) {
      navigate('/cart');
      return;
    }
  }, [cart.items, navigate]);

  const handleCloseCheckout = () => {
    setCheckoutOpen(false);
    navigate('/cart');
  };

  // Show loading or redirect if no items
  if (!cart.items || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <main className="container mx-auto px-4 py-16">
          <Card className="max-w-md mx-auto text-center">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <ShoppingBag className="w-6 h-6" />
                Cart is Empty
              </CardTitle>
              <CardDescription>
                Add some items to your cart before checking out
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/products')} className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Continue Shopping
              </Button>
            </CardContent>
          </Card>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Checkout
            </h1>
            <p className="text-muted-foreground">
              Complete your order with secure payment
            </p>
          </div>

          {/* Enhanced Checkout Flow Component */}
          <EnhancedCheckoutFlow
            isOpen={checkoutOpen}
            onClose={handleCloseCheckout}
          />

          {/* Fallback content if checkout dialog is closed */}
          {!checkoutOpen && (
            <Card>
              <CardHeader>
                <CardTitle>Checkout</CardTitle>
                <CardDescription>
                  Complete your order securely
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Checkout process closed. Click below to reopen:</p>
                <Button onClick={() => setCheckoutOpen(true)} className="w-full">
                  Reopen Checkout
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};

export default Checkout;
