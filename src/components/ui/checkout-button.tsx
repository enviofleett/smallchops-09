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
  return <>
      

      <EnhancedCheckoutFlow isOpen={showCheckout} onClose={() => setShowCheckout(false)} />
    </>;
};