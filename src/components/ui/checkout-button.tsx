import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { EnhancedCheckoutFlow } from '@/components/checkout/EnhancedCheckoutFlow';

export const CheckoutButton: React.FC = () => {
  const { cart } = useCart();
  const [showCheckout, setShowCheckout] = useState(false);

  if (cart.items.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setShowCheckout(true)}
        className="fixed bottom-4 right-4 z-40 shadow-lg"
        size="lg"
      >
        <ShoppingCart className="mr-2 h-4 w-4" />
        Checkout ({cart.itemCount})
      </Button>

      <EnhancedCheckoutFlow
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
      />
    </>
  );
};