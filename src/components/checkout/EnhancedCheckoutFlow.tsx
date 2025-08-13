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
import { Mail, Phone, MapPin, Truck, X, RefreshCw, AlertTriangle } from "lucide-react";
import { DeliveryZoneDropdown } from "@/components/delivery/DeliveryZoneDropdown";
import { PickupPointSelector } from "@/components/delivery/PickupPointSelector";
import { GuestOrLoginChoice } from "./GuestOrLoginChoice";
import { DeliveryScheduler } from "./DeliveryScheduler";
import { PaystackPaymentHandler } from "@/components/payments/PaystackPaymentHandler";
import { storeRedirectUrl } from "@/utils/redirect";
import { useOrderProcessing } from "@/hooks/useOrderProcessing";
import { validatePaymentInitializationData, normalizePaymentData, generateUserFriendlyErrorMessage } from "@/utils/paymentDataValidator";
import { debugPaymentInitialization, quickPaymentDiagnostic, logPaymentAttempt } from "@/utils/paymentDebugger";
import { useCheckoutStateRecovery } from "@/utils/checkoutStateManager";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields only for delivery orders
    if (formData.fulfillment_type === 'delivery' && (!formData.delivery_date || !formData.delivery_time_slot)) {
      toast({
        title: "Delivery Schedule Required",
        description: "Please select a delivery date and time before proceeding.",
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
        
        // Extract payment URL with fallbacks
        let authUrl = paymentObj.authorization_url;
        let paymentUrl = paymentObj.payment_url || authUrl;
        
        console.log('🔍 URL extraction debug:', {
          authUrl: authUrl,
          paymentUrl: paymentUrl,
          authUrlType: typeof authUrl,
          paymentUrlType: typeof paymentUrl,
          authUrlLength: authUrl?.length,
          paymentUrlLength: paymentUrl?.length
        });
        
        // Fallback: if no URL but we have a reference, try to re-initialize payment to get the URL
        if ((!paymentUrl || (typeof paymentUrl === 'string' && paymentUrl.trim() === '')) && paymentObj.reference) {
          console.warn('⚠️ Missing payment URL; attempting fallback initialization via paystack-secure...');
          const initBody = {
            action: 'initialize',
            email: sanitizedData.customer_email,
            amount: Math.round((totalAmount || sanitizedData.total_amount) * 100),
            metadata: {
              order_id: orderId,
              customer_name: sanitizedData.customer_name,
              order_number: orderNumber
            },
            callback_url: `${window.location.origin}/payment/callback?order_id=${orderId}`
          };
          const { data: initResp, error: initErr } = await supabase.functions.invoke('paystack-secure', { body: initBody });
          console.log('🔁 Fallback init response:', { initResp, initErr });
          if (!initErr && initResp?.status && (initResp.data?.authorization_url || initResp.authorization_url)) {
            authUrl = initResp.data?.authorization_url || initResp.authorization_url;
            paymentUrl = initResp.data?.authorization_url || initResp.authorization_url;
          }
        }
        
        // Final validation for URL
        if (!paymentUrl || (typeof paymentUrl === 'string' && paymentUrl.trim() === '')) {
          console.error('❌ No payment URL found:', paymentObj);
          setLastPaymentError('Payment URL not available');
          handlePaymentFailure({ type: 'no_payment_url', responseData: paymentObj });
          throw new Error('No payment URL in response');
        }
        
        console.log('✅ Valid payment URL found:', paymentUrl);
        
        // Save order details for success page
        const orderDetails = {
          orderId,
          orderNumber,
          totalAmount,
          customerEmail: sanitizedData.customer_email,
          customerName: sanitizedData.customer_name,
          fulfillmentType: sanitizedData.fulfillment_type,
          deliveryAddress: sanitizedData.delivery_address,
          orderItems: sanitizedData.order_items
        };
        sessionStorage.setItem('orderDetails', JSON.stringify(orderDetails));
        
        // Clear cart and checkout state
        clearCart();
        clearState();
        
        logPaymentAttempt(sanitizedData, 'success', { 
          orderId, 
          orderNumber, 
          paymentUrl,
          reference: paymentObj.reference 
        });
        
        // Remember reference and order details for callback fallback across tabs
        try {
          if (paymentObj?.reference) {
            sessionStorage.setItem('paystack_last_reference', paymentObj.reference);
            localStorage.setItem('paystack_last_reference', paymentObj.reference);
          }
          const details = JSON.stringify({ orderId, orderNumber, reference: paymentObj?.reference });
          sessionStorage.setItem('orderDetails', details);
          localStorage.setItem('orderDetails', details);
        } catch {}
        
        console.log('🚀 Redirecting to payment URL:', paymentUrl);
        try {
          const url = paymentUrl as string;
          if (window.top && window.top !== window.self) {
            // Break out of Lovable preview iframe
            (window.top as Window).location.href = url;
          } else {
            window.location.href = url;
          }
        } catch {
          // Fallback: open new tab if cross-frame navigation is blocked
          window.open(paymentUrl as string, '_blank', 'noopener,noreferrer');
        }
        
      } else {
        console.error('❌ Checkout response indicates failure:', parsedData);
        const errorMessage = parsedData?.message || parsedData?.error || "Failed to process checkout";
        handlePaymentFailure({ type: 'checkout_failed', message: errorMessage });
        logPaymentAttempt(sanitizedData, 'failure', { error: errorMessage });
        toast({
          title: "Checkout Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('💥 Checkout error caught in try-catch:', error);
      console.error('💥 Error type:', typeof error);
      console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      const errorMessage = error instanceof Error ? error.message : "Failed to process checkout. Please try again.";
      setLastPaymentError(errorMessage);
      
      toast({
        title: "Checkout Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = useCallback((reference: string) => {
    markCheckoutInProgress(reference);
    markPaymentCompleted(); // Clear recovery state
    clearCart();
    
    toast({
      title: "Payment Successful!",
      description: "Your payment has been processed successfully.",
    });
    
    window.location.href = `/payment/callback?reference=${reference}&status=success`;
  }, [markCheckoutInProgress, clearCart, markPaymentCompleted]);

  const handlePaymentError = useCallback((error: string) => {
    console.error('❌ Payment error:', error);
    handlePaymentFailure({ type: 'payment_gateway_error', message: error });
    setLastPaymentError(error);
    
    toast({
      title: "Payment Failed",
      description: error || "Your payment was not successful. Please try again.",
      variant: "destructive",
    });
    
    setCheckoutStep('details');
    setShowRecoveryOption(true); // Show recovery option after payment failure
  }, [handlePaymentFailure]);

  // Recovery functions
  const handleRecoverCheckout = useCallback(() => {
    const recovered = recoverState();
    if (recovered) {
      setFormData(recovered.formData);
      setDeliveryFee(recovered.deliveryFee);
      setCheckoutStep(recovered.checkoutStep as 'choice' | 'details' | 'payment');
      setShowRecoveryOption(false);
      setLastPaymentError(null);
      
      toast({
        title: "Checkout Recovered",
        description: "Your previous checkout data has been restored.",
      });
    }
  }, [recoverState]);

  const handleDiscardRecovery = useCallback(() => {
    clearState();
    setShowRecoveryOption(false);
    setLastPaymentError(null);
  }, [clearState]);

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
                : checkoutStep === 'details'
                ? 'Complete your order details and choose your payment method'
                : 'Complete your payment'
              }
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent>

          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Order Summary</h3>
            </div>
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
              {checkoutStep !== 'choice' && formData.fulfillment_type === 'delivery' && deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span>Delivery Fee:</span>
                  <span>₦{deliveryFee.toLocaleString()}</span>
                </div>
              )}
              {checkoutStep !== 'choice' && formData.fulfillment_type === 'pickup' && (
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
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Contact Information
                  {isAuthenticated && (
                    <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      Signed in as {authCustomerAccount?.name || session?.user?.email}
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

               {/* Delivery Scheduling Section - Always visible */}
               <div className="space-y-4 border-2 border-primary/20 rounded-lg p-6 bg-primary/5">
                 <h3 className="font-semibold text-lg flex items-center gap-2 text-primary">
                   <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
                   </svg>
                   Schedule Your Delivery
                 </h3>
                 <p className="text-sm text-muted-foreground">
                   Choose your preferred delivery date and time window
                 </p>
                 <DeliveryScheduler
                   selectedDate={formData.delivery_date}
                   selectedTimeSlot={formData.delivery_time_slot}
                   onScheduleChange={(date, timeSlot) => {
                     setFormData(prev => ({ 
                       ...prev, 
                       delivery_date: date, 
                       delivery_time_slot: timeSlot,
                       fulfillment_type: 'delivery' // Auto-select delivery when scheduling
                     }));
                   }}
                   className="w-full"
                 />
               </div>

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

              {formData.fulfillment_type === 'delivery' && (
                <>

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

                  <DeliveryZoneDropdown
                    selectedZoneId={formData.delivery_zone_id}
                    onZoneSelect={(zoneId, fee) => {
                      setFormData({ ...formData, delivery_zone_id: zoneId });
                      setDeliveryFee(fee);
                    }}
                    orderSubtotal={cart?.summary?.subtotal || 0}
                   />
                 </div>
                 </>
               )}

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
                  disabled={
                    isSubmitting || 
                    items.length === 0 || 
                    !formData.customer_email ||
                    !formData.customer_name ||
                    !formData.customer_phone ||
                    (formData.fulfillment_type === 'delivery' && (!formData.delivery_date || !formData.delivery_time_slot || !formData.delivery_zone_id)) ||
                    (formData.fulfillment_type === 'pickup' && !formData.pickup_point_id)
                  }
                  className="flex-1"
                >
                  {isSubmitting ? "Processing..." : "Continue to Payment"}
                </Button>
              </div>
            </form>
          )}

          {checkoutStep === 'payment' && paymentData && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="font-semibold text-lg mb-2">Complete Payment</h3>
                <p className="text-muted-foreground">
                  Secure payment powered by Paystack
                </p>
              </div>

              <PaystackPaymentHandler
                orderId={paymentData.orderId || paymentData.order_id}
                amount={paymentData.amount}
                email={paymentData.email}
                orderNumber={paymentData.orderNumber}
                successUrl={paymentData.paymentUrl}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onClose={() => setCheckoutStep('details')}
              />

              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => setCheckoutStep('details')} 
                  className="flex-1"
                >
                  Back to Details
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

EnhancedCheckoutFlowComponent.displayName = 'EnhancedCheckoutFlowComponent';

export const EnhancedCheckoutFlow: React.FC<EnhancedCheckoutFlowProps> = (props) => (
  <CheckoutErrorBoundary>
    <EnhancedCheckoutFlowComponent {...props} />
  </CheckoutErrorBoundary>
);
