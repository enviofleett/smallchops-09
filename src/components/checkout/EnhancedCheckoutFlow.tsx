import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useGuestSession } from "@/hooks/useGuestSession";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCustomerProfile } from "@/hooks/useCustomerProfile";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, MapPin, Truck, X, RefreshCw, AlertTriangle, ShoppingBag, Clock, ExternalLink, FileText } from "lucide-react";
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
import { safeErrorMessage, normalizePaymentResponse } from '@/utils/errorHandling';
import { validatePaymentFlow, formatDiagnosticResults } from '@/utils/paymentDiagnostics';
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
  special_instructions?: string;
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
      return null; // Don't show any error message at all
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
  const { isAuthenticated, customerAccount: authCustomerAccount, session } = useCustomerAuth();
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
          delivery_time_end: formData.delivery_time_slot?.end_time,
          special_instructions: formData.special_instructions || null
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
        console.log('🔍 Raw parsedData for debugging:', JSON.stringify(parsedData, null, 2));
        
        // Check if we have payment data directly in response
        const paymentData = parsedData.payment || parsedData.data || parsedData;
        console.log('🔍 Extracted payment data:', paymentData);
        
        // ✅ ENHANCED: Comprehensive payment URL extraction with fallback to paystack-secure
        console.log('🔄 Normalizing payment response with fallback mechanism...');
        
        // Try payment.payment_url first (preferred)
        let payment_url = paymentData?.payment_url;
        
        // Fallback to payment.authorization_url
        if (!payment_url) {
          payment_url = paymentData?.authorization_url;
        }
        
        // Fallback to top-level authorization_url (rare)
        if (!payment_url) {
          payment_url = parsedData?.authorization_url;
        }
        
        // If still no URL but we have a reference, try paystack-secure fallback
        if (!payment_url && paymentData?.reference) {
          console.log('⚠️ Missing payment URL, attempting paystack-secure fallback...');
          
          try {
            // Call paystack-secure directly to get authorization URL
            const fallbackResponse = await supabase.functions.invoke('paystack-secure', {
              body: {
                action: 'initialize',
                email: sanitizedData.customer_email,
                amount: sanitizedData.total_amount * 100, // Convert to kobo
                reference: paymentData.reference,
                metadata: {
                  order_id: parsedData.order_id,
                  customer_name: sanitizedData.customer_name,
                  order_number: parsedData.order_number,
                  fallback_recovery: true
                }
              }
            });
            
            console.log('🔍 Fallback paystack-secure response:', fallbackResponse);
            
            if (fallbackResponse.data?.status && fallbackResponse.data?.data?.authorization_url) {
              payment_url = fallbackResponse.data.data.authorization_url;
              console.log('✅ Fallback authorization URL obtained:', payment_url);
            }
          } catch (fallbackError) {
            console.error('❌ Fallback to paystack-secure failed:', fallbackError);
          }
        }
        
        // Final fallback: build from access_code
        if (!payment_url && paymentData?.access_code) {
          payment_url = `https://checkout.paystack.com/${paymentData.access_code}`;
          console.log('🔧 Built payment_url from access_code:', payment_url);
        }
        
        console.log('🔍 Final payment_url after all attempts:', payment_url);
        
        if (!payment_url) {
          console.error('❌ Payment initialization failed - no authorization URL available');
          console.error('❌ Full response structure:', JSON.stringify(parsedData, null, 2));
          
          const configError = 'Payment initialization failed - unable to get authorization URL. Please try again.';
          setLastPaymentError(configError);
          handlePaymentFailure({ type: 'config_error', responseData: parsedData });
          throw new Error(configError);
        }
        
        // Create processed payment data with the found payment URL
        const processedPaymentData = {
          orderId: parsedData.order_id,
          orderNumber: parsedData.order_number,
          amount: parsedData.total_amount || sanitizedData.total_amount,
          email: sanitizedData.customer_email,
          paymentUrl: payment_url,
          reference: paymentData?.reference,
          access_code: paymentData?.access_code
        };
        
        console.log('✅ Processed payment data:', processedPaymentData);
        
        // INDEPENDENT: Create delivery schedule (non-blocking, payment-safe)
        if (sanitizedData.delivery_schedule && parsedData.order_id) {
          try {
            console.log('🗓️ Creating delivery schedule independently...');
            const scheduleData = {
              order_id: parsedData.order_id,
              delivery_date: sanitizedData.delivery_schedule.delivery_date,
              delivery_time_start: sanitizedData.delivery_schedule.delivery_time_start,
              delivery_time_end: sanitizedData.delivery_schedule.delivery_time_end,
              is_flexible: false, // Default to false for production reliability
              special_instructions: sanitizedData.delivery_schedule.special_instructions || null
            };

            const { error: scheduleError } = await supabase
              .from('order_delivery_schedule')
              .insert(scheduleData);

            if (scheduleError) {
              console.warn('⚠️ Non-blocking: Delivery schedule creation failed:', scheduleError);
              // Silent failure - doesn't affect payment success
            } else {
              console.log('✅ Delivery schedule created successfully for order:', parsedData.order_id);
            }
          } catch (scheduleErr) {
            console.warn('⚠️ Non-blocking: Delivery schedule creation error:', scheduleErr);
            // Completely silent failure - payment flow continues normally
          }
        }
        
        // Mark checkout in progress to persist cart
        markCheckoutInProgress(processedPaymentData.reference);
        
        setPaymentData(processedPaymentData);
        setCheckoutStep('payment');
        setIsSubmitting(false);
        
        logPaymentAttempt(sanitizedData, 'success');
        
      } else {
        console.error('❌ Server responded with success: false');
        
        // Validate and generate user-friendly error message
        const validationResult = validatePaymentInitializationData(parsedData || {});
        const userFriendlyError = generateUserFriendlyErrorMessage(validationResult);
        
        console.error('Error details:', {
          validation: validationResult,
          userMessage: userFriendlyError,
          rawData: parsedData
        });
        
        setLastPaymentError(userFriendlyError);
        handlePaymentFailure({ type: 'checkout_failure', responseData: parsedData });
        
        throw new Error(userFriendlyError);
      }
      
    } catch (error: any) {
      console.error('🚨 Checkout submission error:', error);
      setIsSubmitting(false);
      
      // Enhanced error handling with safe message extraction
      const errorMessage = safeErrorMessage(error);
      
      // Map specific errors to user-friendly messages
      let userFriendlyMessage: string;
      
      if (errorMessage.includes('Payment initialization incomplete - missing authorization URL from server')) {
        userFriendlyMessage = 'Payment system configuration issue. Please contact support.';
      } else if (errorMessage.includes('Payment URL not available')) {
        userFriendlyMessage = 'Unable to redirect to payment. Please try again or contact support.';
      } else {
        // Generate user-friendly error with safe fallback
        const validationResult = validatePaymentInitializationData({
          success: false,
          error: errorMessage
        });
        userFriendlyMessage = generateUserFriendlyErrorMessage(validationResult);
      }
      
      setLastPaymentError(userFriendlyMessage);
      logPaymentAttempt(null, 'failure', errorMessage);
      
      toast({
        title: "Checkout Error",
        description: userFriendlyMessage,
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

  // If on payment step, show simplified payment UI
  if (checkoutStep === 'payment') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Complete Payment</DialogTitle>
            <DialogClose className="absolute right-4 top-4" />
          </DialogHeader>
          
          <div className="py-8 px-4 text-center space-y-6">
            {paymentData && paymentData.paymentUrl ? (
              <>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    You'll be redirected to our secure payment provider (Paystack) complete payment - ₦{paymentData.amount?.toLocaleString()}
                  </p>
                </div>
                
                <Button 
                  onClick={() => window.open(paymentData.paymentUrl, '_blank')}
                  size="lg"
                  className="w-full h-12 text-lg font-semibold"
                >
                  Complete Payment - ₦{paymentData.amount?.toLocaleString()}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => setCheckoutStep('details')}
                  className="w-full"
                >
                  ← Back to Details
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">Preparing payment...</p>
                <Button 
                  variant="outline" 
                  onClick={() => setCheckoutStep('details')}
                  className="w-full"
                >
                  ← Back to Details
                </Button>
              </div>
            )}

            {lastPaymentError && (
              <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
                <p className="text-destructive text-sm">{lastPaymentError}</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCheckoutStep('details')}
                  className="mt-2 w-full"
                >
                  Try Again
                </Button>
              </div>
            )}
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

        <div className="grid grid-cols-1 gap-6 py-6">
          {/* Main Content */}
          <div className="col-span-1">
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

                   {/* Special Instructions */}
                  <Card id="section-special-instructions">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Special Instructions (Optional)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <Label htmlFor="special_instructions">
                          {formData.fulfillment_type === 'delivery' ? 'Delivery Instructions' : 'Pickup Instructions'}
                        </Label>
                        <textarea
                          id="special_instructions"
                          value={formData.special_instructions || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, special_instructions: e.target.value }))}
                          className="mt-1 w-full min-h-[80px] p-3 border border-input rounded-md resize-y"
                          placeholder={
                            formData.fulfillment_type === 'delivery' 
                              ? "e.g., Please call when you arrive, Leave at the gate, Ring the doorbell twice..."
                              : "e.g., I'll be there at the scheduled time, Please call when ready, Ask for [Your Name]..."
                          }
                          maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {formData.special_instructions?.length || 0}/500 characters
                        </p>
                      </div>
                    </CardContent>
                  </Card>

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