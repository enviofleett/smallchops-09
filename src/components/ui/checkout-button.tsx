import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { EnhancedCheckoutFlow } from '@/components/checkout/EnhancedCheckoutFlow';
export const CheckoutButton: React.FC = () => {
  const {
    cart
  } = useCart();
  const [showCheckout, setShowCheckout] = useState(false);

  // Show different button states based on cart content
  const isEmpty = cart.items.length === 0;

  // Don't show button when cart is empty
  if (isEmpty) {
    return null;
  }
  return (
    <>
      <Button 
        onClick={() => setShowCheckout(true)}
        size="lg"
        className="h-12 w-full font-semibold"
      >
        <ShoppingCart className="h-5 w-5 mr-2" />
        Checkout ₦{(cart.summary?.total_amount || 0).toLocaleString()}
      </Button>

      <EnhancedCheckoutFlow isOpen={showCheckout} onClose={() => setShowCheckout(false)} />
    </>
  );
};