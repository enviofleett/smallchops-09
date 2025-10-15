import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { EnhancedCheckoutFlow } from '@/components/checkout/EnhancedCheckoutFlow';
import { formatCurrency } from '@/lib/discountCalculations';
import { calculatePaystackFee } from '@/lib/paystackFees';

export const CheckoutButton: React.FC = () => {
  const { cart } = useCart();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  if (cart.items.length === 0) {
    return null;
  }

  // Calculate total including transaction fee
  const transactionFee = calculatePaystackFee(cart.summary.total_amount);
  const totalWithFees = cart.summary.total_amount + transactionFee;

  return (
    <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
      <DialogTrigger asChild>
        <Button 
          size="lg" 
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          Checkout • {formatCurrency(totalWithFees)}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <EnhancedCheckoutFlow 
          isOpen={isCheckoutOpen} 
          onClose={() => setIsCheckoutOpen(false)} 
        />
      </DialogContent>
    </Dialog>
  );
};