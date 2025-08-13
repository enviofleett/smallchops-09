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
        className="fixed bottom-4 right-4 z-50 shadow-xl hover:shadow-2xl transition-all duration-200 bg-red-600 hover:bg-red-700 text-white border-0"
        size="lg"
      >
        <ShoppingCart className="mr-2 h-4 w-4" />
        <span className="hidden sm:inline">Checkout</span>
        <span className="sm:hidden">Cart</span>
        <span className="ml-1">({cart.itemCount})</span>
      </Button>

      <EnhancedCheckoutFlow
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
      />
    </>
  );
};