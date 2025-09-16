import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Loader2, MapPin, Phone, Clock } from 'lucide-react';
import { useCart, CartItem } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/formatCurrency';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SimpleCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CustomerData {
  name: string;
  email: string;
  phone: string;
}

interface DeliveryData {
  method: 'pickup' | 'delivery';
  location: string;
  address: string;
  fee: number;
}

const SUPABASE_URL = "https://oknnklksdiqaifhxaccs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA";

export const SimpleCheckout: React.FC<SimpleCheckoutProps> = ({ isOpen, onClose }) => {
  const { cart } = useCart();
  const [isLoading, setIsLoading] = useState(false);
  
  const [customerData, setCustomerData] = useState<CustomerData>({
    name: '',
    email: '',
    phone: ''
  });
  
  const [deliveryData, setDeliveryData] = useState<DeliveryData>({
    method: 'pickup',
    location: 'Main Store',
    address: '',
    fee: 0
  });

  const processCheckout = async (cartItems: CartItem[], customerData: CustomerData, deliveryData: DeliveryData) => {
    try {
      console.log('🚀 Starting checkout process...');
      
      // Generate idempotency key to prevent duplicates
      const idempotencyKey = `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate totals
      const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const deliveryFee = deliveryData.fee || 0;
      const totalAmount = subtotal + deliveryFee;
      
      const checkoutPayload = {
        items: cartItems.map(item => ({
          id: item.product_id,
          name: item.product_name,
          price: item.price,
          quantity: item.quantity,
          image_url: item.image_url
        })),
        customer: {
          email: customerData.email || 'guest@startersmallchops.com',
          name: customerData.name || 'Guest Customer',
          phone: customerData.phone || ''
        },
        delivery: {
          method: deliveryData.method || 'pickup',
          location: deliveryData.location || 'Main Store',
          address: deliveryData.address || '',
          fee: deliveryFee
        },
        total_amount: totalAmount,
        idempotency_key: idempotencyKey
      };
      
      console.log('📦 Sending checkout payload:', checkoutPayload);
      
      // Call Supabase Edge Function with proper error handling
      const response = await fetch(`${SUPABASE_URL}/functions/v1/process-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-idempotency-key': idempotencyKey
        },
        body: JSON.stringify(checkoutPayload)
      });
      
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Checkout result:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Checkout failed');
      }
      
      // Redirect to payment
      if (result.payment_url) {
        console.log('🔄 Redirecting to payment...');
        window.location.href = result.payment_url;
      } else if (result.payment?.authorization_url) {
        console.log('🔄 Redirecting to payment (legacy format)...');
        window.location.href = result.payment.authorization_url;
      } else {
        throw new Error('No payment URL received');
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Checkout error:', error);
      
      // Try fallback with Supabase client
      try {
        console.log('🔄 Trying fallback with Supabase client...');
        const { data, error: supabaseError } = await supabase.functions.invoke('process-checkout', {
          body: {
            items: cartItems,
            customer: customerData,
            delivery: deliveryData,
            total_amount: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0) + deliveryData.fee,
            idempotency_key: `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }
        });
        
        if (supabaseError) throw supabaseError;
        
        if (data?.payment_url) {
          window.location.href = data.payment_url;
          return data;
        }
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
      }
      
      // Show user-friendly error
      toast.error('Checkout failed. Please try again or contact support.');
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerData.name || !customerData.email) {
      toast.error('Please fill in required customer information');
      return;
    }
    
    if (deliveryData.method === 'delivery' && !deliveryData.address) {
      toast.error('Please provide delivery address');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await processCheckout(cart.items, customerData, deliveryData);
    } catch (error) {
      console.error('Checkout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateDeliveryMethod = (method: 'pickup' | 'delivery') => {
    setDeliveryData(prev => ({
      ...prev,
      method,
      fee: method === 'delivery' ? 5.00 : 0
    }));
  };

  const totalAmount = cart.summary.total_amount + deliveryData.fee;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Your Order</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={customerData.name}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={customerData.email}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customerData.phone}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+234 XXX XXX XXXX"
                />
              </div>
            </CardContent>
          </Card>

          {/* Delivery Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Delivery Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={deliveryData.method}
                onValueChange={(value: 'pickup' | 'delivery') => updateDeliveryMethod(value)}
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="pickup" id="pickup" />
                  <Label htmlFor="pickup" className="flex items-center gap-2 cursor-pointer flex-1">
                    <MapPin className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Store Pickup</div>
                      <div className="text-sm text-muted-foreground">Free - Ready in 30 minutes</div>
                    </div>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="delivery" id="delivery" />
                  <Label htmlFor="delivery" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Clock className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Home Delivery</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(5.00)} - Within 45-60 minutes
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              {deliveryData.method === 'delivery' && (
                <div>
                  <Label htmlFor="address">Delivery Address *</Label>
                  <Textarea
                    id="address"
                    value={deliveryData.address}
                    onChange={(e) => setDeliveryData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter your full delivery address with landmarks"
                    required
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.product_name} × {item.quantity}</span>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(cart.summary.total_amount)}</span>
                </div>
                
                {cart.summary.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(cart.summary.discount_amount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm">
                  <span>{deliveryData.method === 'delivery' ? 'Delivery Fee' : 'Pickup'}</span>
                  <span>{formatCurrency(deliveryData.fee)}</span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ${formatCurrency(totalAmount)}`
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};