import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/hooks/useCart';
import { useOrderManagement } from '@/hooks/useOrderManagement';
import { usePayment } from '@/hooks/usePayment';
import { PaymentModal } from '@/components/payments/PaymentModal';
import { DeliveryZoneSelector } from '@/components/delivery/DeliveryZoneSelector';
import { toast } from 'sonner';

interface CheckoutFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CheckoutFlow: React.FC<CheckoutFlowProps> = ({ isOpen, onClose }) => {
  const { cart, clearCart } = useCart();
  const { placeOrder, loading: orderLoading } = useOrderManagement();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  
  const [checkoutData, setCheckoutData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    order_type: 'delivery' as 'delivery' | 'pickup',
    delivery_address: '',
    delivery_zone_id: '',
    special_instructions: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setCheckoutData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { customer_name, customer_email, customer_phone, order_type, delivery_address, delivery_zone_id } = checkoutData;
    
    if (!customer_name.trim()) {
      toast.error('Please enter your name');
      return false;
    }
    
    if (!customer_email.trim() || !/\S+@\S+\.\S+/.test(customer_email)) {
      toast.error('Please enter a valid email address');
      return false;
    }
    
    if (!customer_phone.trim()) {
      toast.error('Please enter your phone number');
      return false;
    }
    
    if (order_type === 'delivery') {
      if (!delivery_address.trim()) {
        toast.error('Please enter a delivery address');
        return false;
      }
      if (!delivery_zone_id) {
        toast.error('Please select a delivery zone');
        return false;
      }
    }
    
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) return;
    
    if (cart.items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    try {
      const orderData = await placeOrder(checkoutData, cart.items, {
        subtotal: cart.summary.subtotal,
        tax_amount: cart.summary.tax_amount,
        delivery_fee: cart.summary.delivery_fee,
        discount_amount: cart.summary.discount_amount,
        total_amount: cart.summary.total_amount
      });

      setOrderId(orderData.id);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order. Please try again.');
    }
  };

  const handlePaymentSuccess = () => {
    clearCart();
    setShowPaymentModal(false);
    onClose();
    toast.success('Order placed and payment successful!');
  };

  const handlePaymentClose = () => {
    setShowPaymentModal(false);
    // Order is created but payment not completed
    toast.info('Order saved. You can complete payment later.');
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <CardHeader>
            <CardTitle>Checkout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Order Summary */}
            <div>
              <h3 className="font-semibold mb-3">Order Summary</h3>
              <div className="space-y-2 text-sm">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.product_name} x {item.quantity}</span>
                    <span>₦{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <Separator />
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₦{cart.summary.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>₦{cart.summary.tax_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Fee:</span>
                    <span>₦{cart.summary.delivery_fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>₦{cart.summary.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Customer Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer_name">Full Name *</Label>
                  <Input
                    id="customer_name"
                    value={checkoutData.customer_name}
                    onChange={(e) => handleInputChange('customer_name', e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <Label htmlFor="customer_phone">Phone Number *</Label>
                  <Input
                    id="customer_phone"
                    value={checkoutData.customer_phone}
                    onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="customer_email">Email Address *</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={checkoutData.customer_email}
                  onChange={(e) => handleInputChange('customer_email', e.target.value)}
                  placeholder="Enter your email address"
                />
              </div>
            </div>

            <Separator />

            {/* Order Type */}
            <div className="space-y-4">
              <h3 className="font-semibold">Order Type</h3>
              <RadioGroup
                value={checkoutData.order_type}
                onValueChange={(value) => handleInputChange('order_type', value)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="delivery" id="delivery" />
                  <Label htmlFor="delivery">Delivery</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pickup" id="pickup" />
                  <Label htmlFor="pickup">Pickup</Label>
                </div>
              </RadioGroup>
              
              {checkoutData.order_type === 'delivery' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="delivery_address">Delivery Address *</Label>
                    <Input
                      id="delivery_address"
                      value={checkoutData.delivery_address}
                      onChange={(e) => handleInputChange('delivery_address', e.target.value)}
                      placeholder="Enter your delivery address"
                    />
                  </div>
                  <DeliveryZoneSelector
                    selectedZoneId={checkoutData.delivery_zone_id}
                    onZoneSelect={(zoneId, deliveryFee) => {
                      handleInputChange('delivery_zone_id', zoneId);
                      // Update cart delivery fee
                      cart.updateDeliveryFee(deliveryFee);
                    }}
                    orderSubtotal={cart.summary.subtotal}
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Special Instructions */}
            <div>
              <Label htmlFor="special_instructions">Special Instructions (Optional)</Label>
              <Input
                id="special_instructions"
                value={checkoutData.special_instructions}
                onChange={(e) => handleInputChange('special_instructions', e.target.value)}
                placeholder="Any special requests or instructions"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handlePlaceOrder} 
                disabled={orderLoading || cart.items.length === 0}
                className="flex-1"
              >
                {orderLoading ? 'Placing Order...' : 'Place Order & Pay'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && orderId && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={handlePaymentClose}
          orderData={{
            id: orderId,
            total: cart.summary.total_amount,
            customer_email: checkoutData.customer_email,
            customer_name: checkoutData.customer_name,
            customer_phone: checkoutData.customer_phone
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
};