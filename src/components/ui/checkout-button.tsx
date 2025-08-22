import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

export const CheckoutButton: React.FC = () => {
  const { cart } = useCart();
  const navigate = useNavigate();

  // Show different button states based on cart content
  const isEmpty = cart.items.length === 0;

  // Don't show button when cart is empty
  if (isEmpty) {
    return null;
  }

  const handleCheckoutClick = () => {
    console.log('🛒 CheckoutButton: Navigating to checkout page');
    navigate('/checkout');
  };

  return (
    <Button 
      onClick={handleCheckoutClick}
      size="lg"
      className="h-12 w-full font-semibold"
    >
      <ShoppingCart className="h-5 w-5 mr-2" />
      Checkout ₦{(cart.summary?.total_amount || 0).toLocaleString()}
    </Button>
  );
};
