import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, ShoppingBag, Truck, CreditCard, CheckCircle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { createOrderWithPayment } from '@/utils/paymentOrderCreation';

interface CheckoutState {
  step: 'customer' | 'fulfillment' | 'schedule' | 'payment' | 'review' | 'processing' | 'complete';
  customerInfo: {
    name: string;
    email: string;
    phone: string;
  } | null;
  fulfillment: {
    type: 'delivery' | 'pickup';
    address?: any;
    pickupPointId?: string;
    deliveryZoneId?: string;
  } | null;
  deliverySchedule: {
    delivery_date: string;
    delivery_time_start: string;
    delivery_time_end: string;
    special_instructions?: string;
    is_flexible?: boolean;
  } | null;
  paymentMethod: string;
  termsAccepted: boolean;
  orderId?: string;
  orderNumber?: string;
}

interface EnhancedCheckoutFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EnhancedCheckoutFlow: React.FC<EnhancedCheckoutFlowProps> = ({
  isOpen,
  onClose
}) => {
  const { cart, clearCart } = useCart();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const processCheckout = async () => {
    if (cart.items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setIsProcessing(true);

    try {
      console.log('🛒 Starting enhanced checkout process...');

      // Use the unified checkout that already handles payment initialization
      const checkoutResult = await createOrderWithPayment({
        items: cart.items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          customization_items: item.customizations ? [item.customizations] : []
        })),
        customerInfo: {
          name: user?.email?.split('@')[0] || 'Customer',
          email: user?.email || '',
          phone: ''
        },
        totalAmount: cart.summary.total_amount,
        fulfillmentType: 'delivery'
      });

      console.log('✅ Checkout completed successfully:', {
        orderId: checkoutResult.order?.id,
        orderNumber: checkoutResult.order?.order_number,
        hasPaymentUrl: !!checkoutResult.paymentUrl
      });

      // Clear cart after successful order creation
      clearCart();

      // **CRITICAL FIX:** Use the authorization URL directly from process-checkout
      // This prevents duplicate payment initialization
      if (checkoutResult.paymentUrl) {
        console.log('🔐 Opening payment window with URL from process-checkout');
        
        // Open payment in new tab
        const paymentWindow = window.open(checkoutResult.paymentUrl, '_blank');
        
        if (!paymentWindow) {
          toast.error('Please allow popups to complete payment');
          return;
        }

        toast.success('Order created successfully! Complete payment in the new tab.', {
          duration: 8000,
          description: `Order #${checkoutResult.order?.order_number} - ₦${cart.summary.total_amount.toLocaleString()}`
        });

        // Close checkout modal
        onClose();
      } else {
        throw new Error('Payment URL not provided by checkout process');
      }

    } catch (error) {
      console.error('❌ Enhanced checkout failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Checkout failed';
      toast.error('Checkout Failed', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStep = () => {
    if (!isOpen) return null;
    
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <h3 className="text-xl font-semibold">Review Your Order</h3>
          <p className="text-muted-foreground">
            {cart.items.length} items • Total: ₦{cart.summary.total_amount.toLocaleString()}
          </p>
        </div>
        
        <div className="space-y-4">
          {cart.items.map((item) => (
            <div key={item.id} className="flex justify-between items-center p-4 bg-gray-50 rounded">
              <div>
                <h4 className="font-medium">{item.product_name}</h4>
                <p className="text-sm text-muted-foreground">
                  Qty: {item.quantity} × ₦{item.price.toLocaleString()}
                </p>
              </div>
              <span className="font-medium">₦{(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <Button
          onClick={processCheckout}
          disabled={isProcessing || cart.items.length === 0}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing Order...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Complete Payment - ₦{cart.summary.total_amount.toLocaleString()}
            </>
          )}
        </Button>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Checkout</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="p-6">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};