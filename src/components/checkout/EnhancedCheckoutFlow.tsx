import React, { useState } from 'react';
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useGuestSession } from "@/hooks/useGuestSession";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCustomerProfile } from "@/hooks/useCustomerProfile";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, MapPin, CreditCard, Banknote, Truck, X } from "lucide-react";
import { DeliveryZoneDropdown } from "@/components/delivery/DeliveryZoneDropdown";
import { PickupPointSelector } from "@/components/delivery/PickupPointSelector";
import { GuestOrLoginChoice } from "./GuestOrLoginChoice";
import { storeRedirectUrl } from "@/utils/redirect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

interface DeliveryAddress {
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  landmark?: string;
}

interface CheckoutData {
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: DeliveryAddress;
  payment_method: string;
  delivery_zone_id?: string;
  fulfillment_type: 'delivery' | 'pickup';
  pickup_point_id?: string;
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
  const { profile: customerAccount } = useCustomerProfile();
  const { isAuthenticated, customerAccount: authCustomerAccount } = useAuth();
  const { guestSession, generateGuestSession } = useGuestSession();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [checkoutStep, setCheckoutStep] = useState<'choice' | 'details'>('choice');

  const [formData, setFormData] = useState<CheckoutData>({
    customer_email: authCustomerAccount?.email || '',
    customer_name: authCustomerAccount?.name || customerAccount?.name || '',
    customer_phone: authCustomerAccount?.phone || customerAccount?.phone || '',
    delivery_address: {
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: 'Lagos',
      postal_code: '',
      landmark: ''
    },
    payment_method: '',
    delivery_zone_id: '',
    fulfillment_type: 'delivery',
    pickup_point_id: ''
  });

  const items = cart?.items || [];
  const currentDeliveryFee = formData.fulfillment_type === 'pickup' ? 0 : deliveryFee;
  const total = (cart?.summary?.total_amount || 0) + currentDeliveryFee;

  // Handle authentication choice
  const handleContinueAsGuest = async () => {
    if (!guestSession) {
      await generateGuestSession();
    }
    setCheckoutStep('details');
  };

  const handleLogin = () => {
    // Store current URL for redirect after login
    storeRedirectUrl(window.location.pathname + window.location.search);
    onClose();
    navigate('/auth');
  };

  // Auto-advance to details if user is already authenticated
  React.useEffect(() => {
    if (isAuthenticated && checkoutStep === 'choice') {
      setCheckoutStep('details');
    }
  }, [isAuthenticated, checkoutStep]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (!formData.customer_email || !formData.customer_name || !formData.customer_phone) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required customer details.",
          variant: "destructive",
        });
        return;
      }

      // Validate address/pickup based on fulfillment type
      if (formData.fulfillment_type === 'delivery') {
        if (!formData.delivery_address.address_line_1 || !formData.delivery_address.city) {
          toast({
            title: "Missing Address",
            description: "Please provide a complete delivery address.",
            variant: "destructive",
          });
          return;
        }
        if (!formData.delivery_zone_id) {
          toast({
            title: "Missing Delivery Zone",
            description: "Please select a delivery zone.",
            variant: "destructive",
          });
          return;
        }
      } else if (formData.fulfillment_type === 'pickup') {
        if (!formData.pickup_point_id) {
          toast({
            title: "Missing Pickup Point",
            description: "Please select a pickup location.",
            variant: "destructive",
          });
          return;
        }
      }

      // Process checkout through edge function
      const checkoutData = {
        customer_email: formData.customer_email,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        fulfillment_type: formData.fulfillment_type,
        delivery_address: formData.fulfillment_type === 'delivery' ? formData.delivery_address : undefined,
        pickup_point_id: formData.fulfillment_type === 'pickup' ? formData.pickup_point_id : undefined,
        order_items: items.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity
        })),
        total_amount: total,
        delivery_fee: formData.fulfillment_type === 'delivery' ? deliveryFee : 0,
        delivery_zone_id: formData.fulfillment_type === 'delivery' ? formData.delivery_zone_id : undefined,
        payment_method: 'paystack',
        guest_session_id: !isAuthenticated ? guestSession?.sessionId : undefined
      };

      console.log('Processing checkout:', checkoutData);

      const { data, error } = await supabase.functions.invoke('process-checkout', {
        body: checkoutData
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        toast({
          title: "Checkout Failed",
          description: data.message || "Failed to process checkout",
          variant: "destructive",
        });
        return;
      }

      // Redirect to Paystack for payment
      if (data.payment?.payment_url) {
        window.location.href = data.payment.payment_url;
        return;
      }
      clearCart();
      toast({
        title: "Order Placed Successfully!",
        description: `Order ${data.order_number} has been created. ${data.payment?.message || 'You will receive a confirmation email shortly.'}`,
      });

      // Navigate based on authentication status
      if (isAuthenticated) {
        navigate("/customer-portal?tab=orders");
      } else {
        navigate("/home");
      }

    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Checkout Error",
        description: error instanceof Error ? error.message : "Failed to process checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  console.log('🔄 EnhancedCheckoutFlow render - isOpen:', isOpen, 'cart items:', cart?.items?.length);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Secure Checkout</CardTitle>
            <CardDescription>
              {checkoutStep === 'choice' 
                ? 'Choose how you want to proceed with your order'
                : 'Complete your order details and choose your payment method'
              }
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent>
          {/* Order Summary */}
          <div className="space-y-4 mb-6">
            <h3 className="font-semibold text-lg">Order Summary</h3>
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.product_name} × {item.quantity}</span>
                  <span>₦{(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₦{(cart?.summary?.subtotal || 0).toLocaleString()}</span>
              </div>
              {checkoutStep === 'details' && formData.fulfillment_type === 'delivery' && deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span>Delivery Fee:</span>
                  <span>₦{deliveryFee.toLocaleString()}</span>
                </div>
              )}
              {checkoutStep === 'details' && formData.fulfillment_type === 'pickup' && (
                <div className="flex justify-between text-green-600">
                  <span>Pickup (No delivery fee):</span>
                  <span>FREE</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                <span>Total:</span>
                <span>₦{total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Guest vs Login Choice */}
          {checkoutStep === 'choice' && !isAuthenticated && (
            <GuestOrLoginChoice
              totalAmount={total}
              onContinueAsGuest={handleContinueAsGuest}
              onLogin={handleLogin}
            />
          )}

          {/* Checkout Details Form */}
          {checkoutStep === 'details' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Contact Information
                  {isAuthenticated && (
                    <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      Signed in as {authCustomerAccount?.name}
                    </span>
                  )}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customer_name">Full Name *</Label>
                    <Input
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      placeholder="Enter your full name"
                      disabled={isAuthenticated}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer_phone">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="customer_phone"
                        value={formData.customer_phone}
                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        placeholder="e.g., +234 801 234 5678"
                        className="pl-10"
                        disabled={isAuthenticated && !!authCustomerAccount?.phone}
                        required
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="customer_email">Email Address *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="customer_email"
                      type="email"
                      value={formData.customer_email}
                      onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                      placeholder="your.email@example.com"
                      className="pl-10"
                      disabled={isAuthenticated}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Fulfillment Options */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Fulfillment Options
                </h3>
                <RadioGroup
                  value={formData.fulfillment_type}
                  onValueChange={(value: 'delivery' | 'pickup') => {
                    setFormData({ ...formData, fulfillment_type: value });
                    if (value === 'pickup') {
                      setDeliveryFee(0);
                    }
                  }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <Card className="cursor-pointer hover:border-primary transition-colors">
                    <CardContent className="flex items-center space-x-3 p-4">
                      <RadioGroupItem value="delivery" id="delivery" />
                      <Truck className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <Label htmlFor="delivery" className="text-sm font-medium cursor-pointer">
                          Home Delivery
                        </Label>
                        <p className="text-xs text-muted-foreground">Get your order delivered to your address</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="cursor-pointer hover:border-primary transition-colors">
                    <CardContent className="flex items-center space-x-3 p-4">
                      <RadioGroupItem value="pickup" id="pickup" />
                      <MapPin className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <Label htmlFor="pickup" className="text-sm font-medium cursor-pointer">
                          Store Pickup
                        </Label>
                        <p className="text-xs text-muted-foreground">Pick up your order from our store location</p>
                      </div>
                    </CardContent>
                  </Card>
                </RadioGroup>
              </div>

              {/* Delivery Address (only show for delivery) */}
              {formData.fulfillment_type === 'delivery' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Delivery Address
                  </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="address_line_1">Street Address *</Label>
                    <Input
                      id="address_line_1"
                      value={formData.delivery_address.address_line_1}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, address_line_1: e.target.value }
                      })}
                      placeholder="House number and street name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="address_line_2">Apartment/Unit (Optional)</Label>
                    <Input
                      id="address_line_2"
                      value={formData.delivery_address.address_line_2}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, address_line_2: e.target.value }
                      })}
                      placeholder="Apartment, suite, unit, etc."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={formData.delivery_address.city}
                        onChange={(e) => setFormData({
                          ...formData,
                          delivery_address: { ...formData.delivery_address, city: e.target.value }
                        })}
                        placeholder="e.g., Lagos"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State *</Label>
                      <Select
                        value={formData.delivery_address.state}
                        onValueChange={(value) => setFormData({
                          ...formData,
                          delivery_address: { ...formData.delivery_address, state: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Lagos">Lagos</SelectItem>
                          <SelectItem value="Abuja">Abuja</SelectItem>
                          <SelectItem value="Ogun">Ogun</SelectItem>
                          <SelectItem value="Rivers">Rivers</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="landmark">Landmark (Optional)</Label>
                    <Input
                      id="landmark"
                      value={formData.delivery_address.landmark}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, landmark: e.target.value }
                      })}
                      placeholder="Nearest landmark or additional directions"
                    />
                  </div>
                </div>

                  {/* Delivery Zone Dropdown */}
                  <DeliveryZoneDropdown
                    selectedZoneId={formData.delivery_zone_id}
                    onZoneSelect={(zoneId, fee) => {
                      setFormData({ ...formData, delivery_zone_id: zoneId });
                      setDeliveryFee(fee);
                    }}
                    orderSubtotal={cart?.summary?.subtotal || 0}
                  />
                </div>
              )}

              {/* Pickup Point Selection (only show for pickup) */}
              {formData.fulfillment_type === 'pickup' && (
                <div className="space-y-4">
                  <PickupPointSelector
                    selectedPointId={formData.pickup_point_id}
                    onSelect={(pickupPoint) => {
                      setFormData({ 
                        ...formData, 
                        pickup_point_id: pickupPoint?.id || '' 
                      });
                    }}
                  />
                </div>
              )}

              {/* Payment Method */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Method
                </h3>
                <Card className="border-primary bg-primary/5">
                  <CardContent className="flex items-center space-x-3 p-4">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">Secure Card Payment</div>
                      <p className="text-xs text-muted-foreground">Pay securely with your debit/credit card via Paystack</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6">
                <Button 
                  type="button" 
                  onClick={() => isAuthenticated ? onClose() : setCheckoutStep('choice')} 
                  variant="outline" 
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isAuthenticated ? 'Cancel' : 'Back'}
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || items.length === 0} 
                  className="flex-1"
                >
                  {isSubmitting ? "Processing..." : "Place Order"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};