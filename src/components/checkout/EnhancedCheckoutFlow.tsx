import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useGuestSession } from "@/hooks/useGuestSession";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCustomerProfile } from "@/hooks/useCustomerProfile";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, MapPin, Truck, X, RefreshCw, AlertTriangle, ShoppingBag, Clock, ExternalLink } from "lucide-react";
import { DeliveryZoneDropdown } from "@/components/delivery/DeliveryZoneDropdown";
import { PickupPointSelector } from "@/components/delivery/PickupPointSelector";
import { GuestOrLoginChoice } from "./GuestOrLoginChoice";
import { DeliveryScheduler } from "./DeliveryScheduler";
import { OrderSummaryCard } from "./OrderSummaryCard";
import { PaystackPaymentHandler } from "@/components/payments/PaystackPaymentHandler";
import { storeRedirectUrl } from "@/utils/redirect";
import { useOrderProcessing } from "@/hooks/useOrderProcessing";
import { validatePaymentInitializationData, normalizePaymentData, generateUserFriendlyErrorMessage } from "@/utils/paymentDataValidator";
import { debugPaymentInitialization, quickPaymentDiagnostic, logPaymentAttempt } from "@/utils/paymentDebugger";
import { useCheckoutStateRecovery } from "@/utils/checkoutStateManager";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
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
  delivery_date?: string;
  delivery_time_slot?: {
    start_time: string;
    end_time: string;
  };
}

interface EnhancedCheckoutFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

// Error boundary component
class CheckoutErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 Checkout error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center">
          <p className="text-destructive">Something went wrong with checkout. Please refresh and try again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const EnhancedCheckoutFlowComponent: React.FC<EnhancedCheckoutFlowProps> = React.memo(({ 
  isOpen, 
  onClose 
}) => {
  const { cart, clearCart } = useCart();
  const { profile: customerAccount } = useCustomerProfile();
  const { isAuthenticated, customerAccount: authCustomerAccount, session } = useAuth();
  const { guestSession, generateGuestSession } = useGuestSession();
  const { markCheckoutInProgress } = useOrderProcessing();
  const navigate = useNavigate();
  const { 
    saveState, 
    recoverState, 
    clearState, 
    hasRecoverableState,
    savePrePaymentState,
    markPaymentCompleted,
    handlePaymentFailure,
    getRetryInfo
  } = useCheckoutStateRecovery();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [checkoutStep, setCheckoutStep] = useState<'choice' | 'details' | 'payment'>('choice');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [lastPaymentError, setLastPaymentError] = useState<string | null>(null);
  const [showRecoveryOption, setShowRecoveryOption] = useState(false);

  const [formData, setFormData] = useState<CheckoutData>({
    customer_email: session?.user?.email || '',
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

  const items = useMemo(() => cart?.items || [], [cart?.items]);
  const currentDeliveryFee = useMemo(() => 
    formData.fulfillment_type === 'pickup' ? 0 : deliveryFee, 
    [formData.fulfillment_type, deliveryFee]
  );
  const total = useMemo(() => 
    (cart?.summary?.total_amount || 0) + currentDeliveryFee, 
    [cart?.summary?.total_amount, currentDeliveryFee]
  );

  // Initialization effect - skip recovery UI completely
  useEffect(() => {
    if (isOpen) {
      // Clear any previous state without showing recovery UI
      clearState();
      
      // For empty cart, redirect to browse products first
      if (isEmpty && isAuthenticated) {
        setCheckoutStep('choice'); // Show options to browse or continue
      } else if (!isAuthenticated) {
        setCheckoutStep('choice');
      } else {
        setCheckoutStep('details');
      }
    }
  }, [isOpen, isAuthenticated]);

  // Check if cart is empty
  const isEmpty = !cart?.items?.length;

  // Clear payment state when component mounts or step changes
  useEffect(() => {
    if (checkoutStep !== 'payment') {
      setPaymentData(null);
      setLastPaymentError(null);
    }
  }, [checkoutStep]);

  // Auto-save state when form data changes
  useEffect(() => {
    if (checkoutStep === 'details' && formData.customer_email) {
      saveState(formData, checkoutStep, deliveryFee);
    }
  }, [formData, checkoutStep, deliveryFee]);

  // Guest checkout completely disabled - this function now just redirects to login
  const handleContinueAsGuest = useCallback(() => {
    handleLogin();
  }, []);

  const handleLogin = useCallback(() => {
    storeRedirectUrl(window.location.pathname + window.location.search);
    onClose();
    navigate('/auth');
  }, [onClose, navigate]);

  React.useEffect(() => {
    if (isAuthenticated) {
      setCheckoutStep('details');
    } else {
      setCheckoutStep('choice');
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (session?.user || authCustomerAccount) {
      setFormData(prev => ({
        ...prev,
        customer_email: session?.user?.email || prev.customer_email,
        customer_name: authCustomerAccount?.name || customerAccount?.name || prev.customer_name,
        customer_phone: authCustomerAccount?.phone || customerAccount?.phone || prev.customer_phone,
      }));
    }
  }, [session, authCustomerAccount, customerAccount]);

  const isFormValid = useMemo(() => {
    if (!formData.customer_email || !formData.customer_name || !formData.customer_phone) {
      return false;
    }
    
    // Both fulfillment types require a scheduled date and time window
    const hasSchedule = !!(formData.delivery_date && formData.delivery_time_slot);
    if (!hasSchedule) return false;
    
    if (formData.fulfillment_type === 'delivery') {
      return !!formData.delivery_zone_id; // zone is mandatory for delivery
    }
    
    if (formData.fulfillment_type === 'pickup') {
      return !!formData.pickup_point_id; // pickup point is mandatory for pickup
    }
    
    return false;
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate schedule for both fulfillment types
    if (!formData.delivery_date || !formData.delivery_time_slot) {
      toast({
        title: "Schedule Required",
        description: "Please select a date and time window before proceeding.",
        variant: "destructive",
      });
      return;
    }

    // Additional validations by type
    if (formData.fulfillment_type === 'delivery' && !formData.delivery_zone_id) {
      toast({
        title: "Delivery Zone Required",
        description: "Please select your delivery zone to continue.",
        variant: "destructive",
      });
      return;
    }
    if (formData.fulfillment_type === 'pickup' && !formData.pickup_point_id) {
      toast({
        title: "Pickup Location Required",
        description: "Please choose a pickup point to continue.",
        variant: "destructive",
      });
      return;
    }
    
    // Clear any previous payment state and errors
    setIsSubmitting(false);
    setPaymentData(null);
    setLastPaymentError(null);
    
    // Add a small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
    
    setIsSubmitting(true);

    try {
      console.log('🚀 Processing checkout (backend will generate reference)');

      const sanitizedData = {
        customer_email: formData.customer_email?.trim(),
        customer_name: formData.customer_name?.trim(),
        customer_phone: formData.customer_phone?.trim() || null,
        fulfillment_type: formData.fulfillment_type,
        delivery_address: formData.fulfillment_type === 'delivery' ? formData.delivery_address : null,
        pickup_point_id: formData.fulfillment_type === 'pickup' ? formData.pickup_point_id : null,
        order_items: items.map(item => {
          // Check if this is a custom bundle by checking the product_id format
          const isCustomBundle = item.product_id && !item.product_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
          
          if (isCustomBundle) {
            // For custom bundles, include the customization_items from the cart item
            const customizationItems = (item as any).customization_items || [];
            
            return {
              product_id: String(item.product_id || ''),
              product_name: item.product_name,
              quantity: Number(item.quantity || 1),
              unit_price: Number(item.price || 0),
              total_price: Number((item.price || 0) * (item.quantity || 1)),
              customization_items: customizationItems
            };
          } else {
            // For regular products
            return {
              product_id: String(item.product_id || ''),
              quantity: Number(item.quantity || 1),
              unit_price: Number(item.price || 0),
              total_price: Number((item.price || 0) * (item.quantity || 1))
            };
          }
        }),
        total_amount: total,
        delivery_fee: formData.fulfillment_type === 'delivery' ? deliveryFee : 0,
        delivery_zone_id: formData.fulfillment_type === 'delivery' && formData.delivery_zone_id ? formData.delivery_zone_id : null,
        delivery_schedule: {
          delivery_date: formData.delivery_date,
          delivery_time_start: formData.delivery_time_slot?.start_time,
          delivery_time_end: formData.delivery_time_slot?.end_time
        },
        payment_method: 'paystack',
        guest_session_id: null, // Guest checkout disabled
        timestamp: new Date().toISOString()
      };

      // Save pre-payment state
      savePrePaymentState(formData, checkoutStep, deliveryFee, null);

      console.log('🚀 Processing checkout with enhanced debugging...');
      console.log('🔍 Sanitized data being sent:', sanitizedData);
      
      // Log payment attempt
      logPaymentAttempt(sanitizedData, 'attempt');

      console.log('🌐 Calling Supabase function: process-checkout');
      const { data, error } = await supabase.functions.invoke('process-checkout', {
        body: sanitizedData
      });

      console.log('📥 Raw Supabase response received:', { data, error, dataType: typeof data });

      if (error) {
        console.error('🔍 Supabase function error:', error);
        handlePaymentFailure({ type: 'supabase_error', message: error.message });
        throw new Error(error.message);
      }

      console.log('✅ No Supabase error, processing response data...');

      let parsedData = data;
      console.log('🔄 Parsing response data, current type:', typeof data);
      
      if (typeof data === 'string') {
        console.log('📝 Response is string, attempting JSON parse...');
        try {
          parsedData = JSON.parse(data);
          console.log('✅ JSON parse successful');
        } catch (parseError) {
          console.error('❌ Failed to parse JSON response:', parseError);
          console.error('❌ Raw response was:', data);
          handlePaymentFailure({ type: 'parse_error', message: 'Invalid response format' });
          throw new Error('Invalid response format from server');
        }
      }

      console.log('🔍 Final parsed data:', parsedData);
      console.log('🔍 Success flag:', parsedData?.success);

      if (parsedData?.success === true) {
        console.log('✅ Success response received, analyzing structure...');
        
        // Detect and handle nested response structures from Supabase
        let workingData = parsedData;
        console.log('🔍 Initial data keys:', Object.keys(parsedData));
        
        // Handle possible nested data structures (Supabase sometimes wraps responses)
        if (parsedData.data && typeof parsedData.data === 'object' && !parsedData.payment) {
          console.log('📦 Found nested data structure, unwrapping...');
          workingData = parsedData.data;
          console.log('🔍 Unwrapped data keys:', Object.keys(workingData));
        }
        
        // Locate payment object with fallbacks
        let paymentObj = workingData.payment;
        if (!paymentObj && workingData.data?.payment) {
          console.log('📦 Payment object found in nested location...');
          paymentObj = workingData.data.payment;
        }
        
        console.log('🔍 Payment object located:', !!paymentObj);
        if (paymentObj) {
          console.log('🔍 Payment object keys:', Object.keys(paymentObj));
          console.log('🔍 Authorization URL:', paymentObj.authorization_url);
          console.log('🔍 Payment URL:', paymentObj.payment_url);
        }
        
        // Validate we have essential data
        if (!paymentObj) {
          console.error('❌ No payment object found in response structure');
          setLastPaymentError('Payment initialization failed - no payment data');
          handlePaymentFailure({ type: 'no_payment_object', responseData: parsedData });
          throw new Error('No payment object in response');
        }
        
        // Extract order details early for potential fallback
        const orderNumber = workingData.order_number || workingData.data?.order_number;
        const totalAmount = workingData.total_amount || workingData.data?.total_amount;
        const orderId = workingData.order_id || workingData.data?.order_id;
        
        console.log('✅ Order details extracted:', { orderNumber, totalAmount, orderId });
        
        // Extract payment URL with robust fallbacks
        let authUrl = paymentObj.authorization_url;
        let paymentUrl = paymentObj.payment_url || authUrl;
        
        // Client-side fallback: build URL from access_code if needed
        if (!paymentUrl && paymentObj.access_code) {
          paymentUrl = `https://checkout.paystack.com/${paymentObj.access_code}`;
          console.log('🔧 Built fallback payment URL from access_code:', paymentUrl);
        }
        
        console.log('🔍 URL extraction debug:', {
          authUrl: authUrl,
          paymentUrl: paymentUrl,
          accessCode: paymentObj.access_code,
          authUrlType: typeof authUrl,
          paymentUrlType: typeof paymentUrl,
          authUrlLength: authUrl?.length,
          paymentUrlLength: paymentUrl?.length
        });
        
        // Final validation for URL
        if (!paymentUrl || (typeof paymentUrl === 'string' && paymentUrl.trim() === '')) {
          console.error('❌ No payment URL found:', paymentObj);
          setLastPaymentError('Payment URL not available');
          throw new Error('No payment URL available');
        }
        
        console.log('✅ Payment URL validated:', paymentUrl);
        
        const processedPaymentData = {
          orderId: orderId,
          orderNumber: orderNumber,
          amount: totalAmount || sanitizedData.total_amount,
          email: sanitizedData.customer_email,
          paymentUrl: paymentUrl,
          ...paymentObj
        };
        
        console.log('✅ Processed payment data:', processedPaymentData);
        
        setPaymentData(processedPaymentData);
        setCheckoutStep('payment');
        setIsSubmitting(false);
        
        logPaymentAttempt(sanitizedData, 'success');
        
        toast({
          title: "Payment Initialized",
          description: "Redirecting to secure payment...",
        });
        
      } else {
        console.error('❌ Server responded with success: false');
        console.error('❌ Response details:', parsedData);
        throw new Error(parsedData?.message || 'Unknown error from server');
      }
      
    } catch (error: any) {
      console.error('🚨 Checkout submission error:', error);
      setIsSubmitting(false);
      setLastPaymentError(error?.message || 'An unexpected error occurred');
      
      logPaymentAttempt(null, 'failure', error?.message);
      
      toast({
        title: "Checkout Error",
        description: generateUserFriendlyErrorMessage(error?.message),
        variant: "destructive",
      });
    }
  };

  const handlePaymentSuccess = useCallback(() => {
    markPaymentCompleted();
    clearCart();
    clearState();
    onClose();
    
    toast({
      title: "Payment Successful!",
      description: "Your order has been confirmed. You'll receive an email confirmation shortly.",
    });
    
    navigate('/orders');
  }, [clearCart, clearState, onClose, navigate, markPaymentCompleted]);

  const handlePaymentError = useCallback((error: string) => {
    console.error('💳 Payment error:', error);
    setLastPaymentError(error);
    handlePaymentFailure({ type: 'payment_error', message: error });
    setCheckoutStep('details');
    
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive",
    });
  }, [handlePaymentFailure]);

  if (!isOpen) return null;

  // If on payment step, show payment section within the main dialog
  if (checkoutStep === 'payment') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Complete Your Payment
            </DialogTitle>
            <DialogClose className="absolute right-4 top-4" />
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
            {/* Mobile Order Summary - Collapsible */}
            <div className="md:hidden">
              <OrderSummaryCard
                items={items}
                subtotal={cart?.summary?.total_amount || 0}
                deliveryFee={currentDeliveryFee}
                total={total}
                collapsibleOnMobile={true}
              />
            </div>

            {/* Main Content */}
            <div className="md:col-span-2 space-y-6">
              <Card id="section-click-to-pay">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Click to Pay
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setCheckoutStep('details')}
                    className="w-full mb-4"
                  >
                    ← Back to Details
                  </Button>

                  <div className="text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      You'll be redirected to our secure payment provider (Paystack)
                    </p>
                    
                     {paymentData && paymentData.paymentUrl && (
                       <div className="space-y-4">
                         <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                           <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                             <span>Order: {paymentData.orderNumber}</span>
                             <span>•</span>
                             <span>₦{paymentData.amount?.toLocaleString()}</span>
                           </div>
                           <Button 
                             onClick={() => window.open(paymentData.paymentUrl, '_blank')}
                             size="lg"
                             className="w-full h-12 font-semibold"
                           >
                             <ExternalLink className="h-4 w-4 mr-2" />
                             Complete Payment - ₦{paymentData.amount?.toLocaleString()}
                           </Button>
                         </div>
                         <p className="text-xs text-muted-foreground text-center">
                           Clicking will open Paystack in a new tab for secure payment
                         </p>
                       </div>
                     )}

                    {lastPaymentError && (
                      <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                        <p className="text-red-800 text-sm">{lastPaymentError}</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setCheckoutStep('details')}
                          className="mt-2"
                        >
                          Try Again
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Desktop Order Summary - Sticky */}
            <div className="hidden md:block">
              <OrderSummaryCard
                items={items}
                subtotal={cart?.summary?.total_amount || 0}
                deliveryFee={currentDeliveryFee}
                total={total}
                sticky={true}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Main checkout form
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            {checkoutStep === 'choice' ? 'Get Started' : 'Checkout'}
          </DialogTitle>
          <DialogClose className="absolute right-4 top-4" />
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
          {/* Mobile Order Summary - only show on details step */}
          {checkoutStep === 'details' && (
            <div className="md:hidden">
              <OrderSummaryCard
                items={items}
                subtotal={cart?.summary?.total_amount || 0}
                deliveryFee={currentDeliveryFee}
                total={total}
                collapsibleOnMobile={true}
              />
            </div>
          )}

          {/* Main Content */}
          <div className="md:col-span-2">
            {checkoutStep === 'choice' && !isAuthenticated && (
              <GuestOrLoginChoice
                totalAmount={total}
                onContinueAsGuest={handleContinueAsGuest}
                onLogin={handleLogin}
                isEmpty={isEmpty}
                onBrowseProducts={() => {
                  onClose();
                  navigate('/');
                }}
              />
            )}

            {checkoutStep === 'choice' && isAuthenticated && isEmpty && (
              <div className="text-center space-y-4 py-8">
                <div className="text-6xl mb-4">🛍️</div>
                <h3 className="text-xl font-semibold">Your cart is empty</h3>
                <p className="text-muted-foreground">
                  Add some delicious items to get started with delivery scheduling!
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => { onClose(); navigate('/'); }}>
                    Browse Products
                  </Button>
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {checkoutStep === 'details' && (
              <div className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Contact Information */}
                  <Card id="section-contact-information">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Contact Information
                        {isAuthenticated && (
                          <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                            Signed in as {authCustomerAccount?.name || session?.user?.email}
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.customer_email}
                            onChange={(e) => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
                            required
                            disabled={isAuthenticated}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="name">Full Name *</Label>
                          <Input
                            id="name"
                            value={formData.customer_name}
                            onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                            required
                            disabled={isAuthenticated}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone Number *</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="phone"
                            value={formData.customer_phone}
                            onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                            placeholder="Enter your phone number"
                            className="pl-10 mt-1"
                            disabled={isAuthenticated}
                            required
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Fulfillment Options */}
                  <Card id="section-fulfillment-options">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        Fulfillment Options
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RadioGroup
                        value={formData.fulfillment_type}
                        onValueChange={(value: 'delivery' | 'pickup') => 
                          setFormData(prev => ({ ...prev, fulfillment_type: value }))
                        }
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                      >
                        <div className="flex items-center space-x-2 p-4 border rounded-lg">
                          <RadioGroupItem value="delivery" id="delivery" />
                          <Label htmlFor="delivery" className="flex-1 cursor-pointer">
                            <div>
                              <div className="font-medium">Home Delivery</div>
                              <div className="text-sm text-muted-foreground">
                                Get your order delivered to your doorstep
                              </div>
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-4 border rounded-lg">
                          <RadioGroupItem value="pickup" id="pickup" />
                          <Label htmlFor="pickup" className="flex-1 cursor-pointer">
                            <div>
                              <div className="font-medium">Pickup</div>
                              <div className="text-sm text-muted-foreground">
                                Collect from one of our pickup points
                              </div>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </CardContent>
                  </Card>

                  {/* Schedule Your Order */}
                  <Card id="section-schedule-your-order">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Schedule Your Order
                      </CardTitle>
                      <CardDescription>
                        {formData.fulfillment_type === 'delivery' 
                          ? 'Choose your preferred delivery date and 1-hour time window'
                          : 'Choose your preferred pickup date and 1-hour time window'
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DeliveryScheduler
                        selectedDate={formData.delivery_date}
                        selectedTimeSlot={formData.delivery_time_slot}
                        onScheduleChange={(date, timeSlot) => {
                          setFormData(prev => ({
                            ...prev,
                            delivery_date: date,
                            delivery_time_slot: timeSlot
                          }));
                        }}
                      />
                    </CardContent>
                  </Card>

                  {/* Delivery Zone or Pickup Point - Conditionally placed after scheduling */}
                  {formData.fulfillment_type === 'delivery' && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Delivery Location
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>Delivery Zone *</Label>
                          <DeliveryZoneDropdown
                            selectedZoneId={formData.delivery_zone_id}
                            onZoneSelect={(zoneId, fee) => {
                              setFormData(prev => ({ ...prev, delivery_zone_id: zoneId }));
                              setDeliveryFee(fee);
                            }}
                            orderSubtotal={cart?.summary?.total_amount || 0}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="address_line_1">Address Line 1 *</Label>
                            <Input
                              id="address_line_1"
                              value={formData.delivery_address.address_line_1}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                delivery_address: { ...prev.delivery_address, address_line_1: e.target.value }
                              }))}
                              required
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="address_line_2">Address Line 2</Label>
                            <Input
                              id="address_line_2"
                              value={formData.delivery_address.address_line_2}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                delivery_address: { ...prev.delivery_address, address_line_2: e.target.value }
                              }))}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="city">City *</Label>
                            <Input
                              id="city"
                              value={formData.delivery_address.city}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                delivery_address: { ...prev.delivery_address, city: e.target.value }
                              }))}
                              required
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="state">State *</Label>
                            <Select
                              value={formData.delivery_address.state}
                              onValueChange={(value) => setFormData(prev => ({
                                ...prev,
                                delivery_address: { ...prev.delivery_address, state: value }
                              }))}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select state" />
                              </SelectTrigger>
                              <SelectContent className="z-[300] bg-popover">
                                <SelectItem value="Lagos">Lagos</SelectItem>
                                <SelectItem value="Abuja">Abuja</SelectItem>
                                <SelectItem value="Ogun">Ogun</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="postal_code">Postal Code</Label>
                            <Input
                              id="postal_code"
                              value={formData.delivery_address.postal_code}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                delivery_address: { ...prev.delivery_address, postal_code: e.target.value }
                              }))}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="landmark">Landmark</Label>
                          <Input
                            id="landmark"
                            value={formData.delivery_address.landmark}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              delivery_address: { ...prev.delivery_address, landmark: e.target.value }
                            }))}
                            className="mt-1"
                            placeholder="Nearby landmark for easier location"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {formData.fulfillment_type === 'pickup' && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Pickup Location
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div>
                          <Label>Choose Pickup Point *</Label>
                          <PickupPointSelector
                            selectedPointId={formData.pickup_point_id}
                            onSelect={(pickupPoint) => {
                              setFormData(prev => ({ 
                                ...prev, 
                                pickup_point_id: pickupPoint?.id || '' 
                              }));
                            }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Click to Pay Section */}
                  <Card id="section-click-to-pay">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5" />
                        Click to Pay
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        You'll be redirected to our secure payment provider (Paystack).
                      </p>
                      <Button 
                        type="submit" 
                        size="lg" 
                        className="h-12 w-full font-semibold"
                        disabled={!isFormValid || isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            Click to Pay ₦{total.toLocaleString()}
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </form>
              </div>
            )}
          </div>

          {/* Desktop Order Summary - only show on details step */}
          {checkoutStep === 'details' && (
            <div className="hidden md:block">
              <OrderSummaryCard
                items={items}
                subtotal={cart?.summary?.total_amount || 0}
                deliveryFee={currentDeliveryFee}
                total={total}
                sticky={true}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

EnhancedCheckoutFlowComponent.displayName = 'EnhancedCheckoutFlowComponent';

export const EnhancedCheckoutFlow: React.FC<EnhancedCheckoutFlowProps> = (props) => (
  <CheckoutErrorBoundary>
    <EnhancedCheckoutFlowComponent {...props} />
  </CheckoutErrorBoundary>
);