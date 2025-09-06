import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useGuestSession } from "@/hooks/useGuestSession";
import { useGuestSessionCleanup } from "@/hooks/useGuestSessionCleanup";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCustomerProfile, useCustomerAddresses } from "@/hooks/useCustomerProfile";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, MapPin, Truck, X, RefreshCw, AlertTriangle, ShoppingBag, Clock, ExternalLink, FileText, ChevronLeft } from "lucide-react";
import { DeliveryZoneDropdown } from "@/components/delivery/DeliveryZoneDropdown";
import { PickupPointSelector } from "@/components/delivery/PickupPointSelector";
import { GuestOrLoginChoice } from "./GuestOrLoginChoice";
import { DeliveryScheduler } from "./DeliveryScheduler";
import { OrderSummaryCard } from "./OrderSummaryCard";
import { PaystackPaymentHandler } from "@/components/payments/PaystackPaymentHandler";
import { storeRedirectUrl } from "@/utils/redirect";
import { SafeHtml } from "@/components/ui/safe-html";
import { useOrderProcessing } from "@/hooks/useOrderProcessing";
import '@/components/payments/payment-styles.css';
import { validatePaymentInitializationData, normalizePaymentData, generateUserFriendlyErrorMessage } from "@/utils/paymentDataValidator";
import { debugPaymentInitialization, quickPaymentDiagnostic, logPaymentAttempt } from "@/utils/paymentDebugger";
import { useCheckoutStateRecovery } from "@/utils/checkoutStateManager";
import { safeErrorMessage, normalizePaymentResponse } from '@/utils/errorHandling';
import { validatePaymentFlow, formatDiagnosticResults } from '@/utils/paymentDiagnostics';
import { cn } from "@/lib/utils";
import { useEnhancedMOQValidation } from '@/hooks/useEnhancedMOQValidation';
import { MOQAdjustmentModal } from '@/components/cart/MOQAdjustmentModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
class CheckoutErrorBoundary extends React.Component<{
  children: React.ReactNode;
}, {
  hasError: boolean;
}> {
  constructor(props: any) {
    super(props);
    this.state = {
      hasError: false
    };
  }
  static getDerivedStateFromError() {
    return {
      hasError: true
    };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 Checkout error boundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Checkout Error
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>Something went wrong with the checkout process. Please try again.</p>
              <Button onClick={() => window.location.reload()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Page
              </Button>
            </div>
          </DialogContent>
        </Dialog>;
    }
    return this.props.children;
  }
}
const EnhancedCheckoutFlowComponent = React.memo<EnhancedCheckoutFlowProps>(({
  isOpen,
  onClose
}) => {
  const navigate = useNavigate();
  const {
    cart,
    clearCart,
    getCartTotal
  } = useCart();
  const items = cart.items || [];
  // Initialize guest session for guest checkout support
  useGuestSessionCleanup();
  const { guestSession, generateGuestSession } = useGuestSession();
  const guestSessionId = guestSession?.sessionId;
  const {
    user,
    session,
    isAuthenticated,
    isLoading
  } = useCustomerAuth();
  const {
    profile
  } = useCustomerProfile();
  const {
    addresses
  } = useCustomerAddresses();

  // Initialize checkout step based on authentication status
  const getInitialCheckoutStep = () => {
    if (isAuthenticated) return 'details';
    return 'auth'; // Will allow both login and guest options
  };
  const [checkoutStep, setCheckoutStep] = useState<'auth' | 'details' | 'payment'>(getInitialCheckoutStep());
  const [formData, setFormData] = useState<CheckoutData>({
    customer_email: '',
    customer_name: '',
    customer_phone: '',
    delivery_address: {
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      postal_code: '',
      landmark: ''
    },
    payment_method: 'paystack',
    fulfillment_type: 'delivery'
  });
  const [paymentData, setPaymentData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [circuitBreakerActive, setCircuitBreakerActive] = useState(false);
  const [deliveryZone, setDeliveryZone] = useState<any>(null);
  const [pickupPoint, setPickupPoint] = useState<any>(null);
  const [lastPaymentError, setLastPaymentError] = useState<string | null>(null);
  const [showMOQModal, setShowMOQModal] = useState(false);
  const [moqValidationResult, setMoqValidationResult] = useState<any>(null);

  // Initialize MOQ validation
  const {
    validateMOQWithPricing,
    autoAdjustQuantities
  } = useEnhancedMOQValidation();

  // Initialize checkout state recovery
  const {
    savePrePaymentState,
    markPaymentCompleted,
    clearState: clearRecoveryState,
    hasRecoverableState
  } = useCheckoutStateRecovery();

  // Initialize order processing
  const {
    markCheckoutInProgress
  } = useOrderProcessing();
  const handleClose = () => {
    if (checkoutStep === 'payment' && paymentData) {
      // Don't close during payment process
      toast({
        title: "Payment in Progress",
        description: "Please complete your payment before closing.",
        variant: "destructive"
      });
      return;
    }
    onClose();
  };

  // Handle guest checkout choice
  const handleContinueAsGuest = async () => {
    try {
      // Generate guest session if not already present
      if (!guestSessionId) {
        await generateGuestSession();
      }
      setCheckoutStep('details');
      toast({
        title: "Guest Checkout",
        description: "You can proceed without creating an account.",
      });
    } catch (error) {
      console.error('Error generating guest session:', error);
      toast({
        title: "Error",
        description: "Failed to start guest checkout. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle login choice
  const handleLogin = () => {
    storeRedirectUrl(`${window.location.pathname}${window.location.search}`);
    navigate('/auth');
  };

  // Listen for payment completion messages from popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) return;
      if (event.data.type === 'PAYMENT_SUCCESS') {
        console.log('Payment successful, closing checkout dialog');
        handleClose();
        toast({
          title: "Payment Successful!",
          description: "Your order has been confirmed."
        });
      } else if (event.data.type === 'PAYMENT_FAILED') {
        console.log('Payment failed:', event.data.error);
        toast({
          title: "Payment Failed",
          description: "Please try again or contact support.",
          variant: "destructive"
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleClose]);

  // Manage checkout step based on authentication status
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        setCheckoutStep('details');
      } else {
        setCheckoutStep('auth');
      }
    }
  }, [isAuthenticated, isLoading]);

  // Auto-fill form data from user profile
  useEffect(() => {
    if (isAuthenticated && profile) {
      setFormData(prev => ({
        ...prev,
        customer_email: (profile as any).email || '',
        customer_name: (profile as any).name || '',
        customer_phone: (profile as any).phone || ''
      }));
    }
  }, [isAuthenticated, profile]);

  // Auto-load default delivery address
  useEffect(() => {
    if (isAuthenticated && addresses && addresses.length > 0) {
      const defaultAddress = addresses.find(addr => addr.is_default) || addresses[0];
      if (defaultAddress) {
        setFormData(prev => ({
          ...prev,
          delivery_address: {
            address_line_1: defaultAddress.address_line_1 || '',
            address_line_2: defaultAddress.address_line_2 || '',
            city: defaultAddress.city || '',
            state: defaultAddress.state || '',
            postal_code: defaultAddress.postal_code || '',
            landmark: defaultAddress.landmark || ''
          }
        }));
      }
    }
  }, [isAuthenticated, addresses]);

  // Calculate delivery fee (simple calculation since no getDeliveryFee from useCart)
  const deliveryFee = deliveryZone?.base_fee || 0;

  // Calculate totals
  const subtotal = getCartTotal();
  const total = subtotal + deliveryFee;
  const handleFormChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => {
        const parentData = prev[parent as keyof CheckoutData] as any;
        return {
          ...prev,
          [parent]: {
            ...parentData,
            [child]: value
          }
        };
      });
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };
  const handlePaymentFailure = useCallback((error: any) => {
    console.error('💳 Payment failure handled:', error);
    setIsSubmitting(false);
    const errorMessage = error?.message || 'Payment processing failed';
    toast({
      title: "Payment Failed",
      description: errorMessage,
      variant: "destructive"
    });
  }, []);

  // Remove the processOrder hook usage since it doesn't exist

  const handleFormSubmit = async () => {
    // 🔐 AUTHENTICATION CHECK: Allow both authenticated users and guests with session
    if (!isAuthenticated && !guestSessionId) {
      toast({
        title: "Session Required",
        description: "Please log in or continue as guest to checkout.",
        variant: "destructive"
      });
      setCheckoutStep('auth');
      return;
    }

    // 🔧 CIRCUIT BREAKER: Block after 3 failures within 5 minutes
    if (circuitBreakerActive) {
      toast({
        title: "Too Many Attempts",
        description: "Please wait 5 minutes before trying again.",
        variant: "destructive"
      });
      return;
    }

    // 🔧 DEBOUNCE: Prevent double-clicks during submission
    if (isSubmitting) {
      console.log('⏳ Already submitting, ignoring duplicate request');
      return;
    }
    try {
      setIsSubmitting(true);
      setLastPaymentError(null);

      // Validate MOQ requirements before processing
      console.log('🔍 Validating MOQ requirements for cart:', items);
      const moqValidation = await validateMOQWithPricing(items);
      if (!moqValidation.isValid && moqValidation.violations.length > 0) {
        console.log('❌ MOQ validation failed:', moqValidation.violations);

        // Try to auto-adjust quantities
        const adjustmentResult = await autoAdjustQuantities(items);
        if (adjustmentResult.adjustmentsMade.length > 0) {
          // Show adjustment modal
          setMoqValidationResult(adjustmentResult);
          setShowMOQModal(true);
          setIsSubmitting(false);
          return;
        } else {
          // Cannot auto-adjust, show error
          throw new Error(`MOQ requirements not met: ${moqValidation.violations[0].productName} requires minimum ${moqValidation.violations[0].minimumRequired} items`);
        }
      }

      // Validate required fields after MOQ check
      if (!formData.customer_email?.trim()) {
        throw new Error('Customer email is required');
      }
      if (!formData.customer_name?.trim()) {
        throw new Error('Customer name is required');
      }
      if (!formData.fulfillment_type) {
        throw new Error('Fulfillment type is required');
      }

      // Enhanced data sanitization and validation - Structure payload for backend
      const sanitizedData = {
        customer: {
          name: formData.customer_name.trim(),
          email: formData.customer_email.trim().toLowerCase(),
          phone: formData.customer_phone?.trim() || undefined,
          guest_session_id: guestSessionId || undefined // Include guest session for guest users
        },
        items: items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name || 'Product',
          quantity: item.quantity,
          unit_price: item.price,
          customizations: item.customizations || undefined
        })),
        fulfillment: {
          type: formData.fulfillment_type,
          address: formData.fulfillment_type === 'delivery' ? formData.delivery_address : undefined,
          pickup_point_id: formData.fulfillment_type === 'pickup' ? formData.pickup_point_id : undefined,
          delivery_zone_id: deliveryZone?.id || undefined
        },
        delivery_schedule: formData.delivery_date ? {
          delivery_date: formData.delivery_date,
          delivery_time_start: formData.delivery_time_slot?.start_time || '09:00',
          delivery_time_end: formData.delivery_time_slot?.end_time || '17:00',
          is_flexible: false,
          special_instructions: formData.special_instructions || null
        } : null,
        payment: {
          method: formData.payment_method || 'paystack'
        }
      };
      console.log('📦 Submitting checkout data:', sanitizedData);

      // Call Supabase edge function with authentication
      const {
        data,
        error
      } = await supabase.functions.invoke('process-checkout', {
        body: sanitizedData,
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      // 🚨 CRITICAL: Stop flow immediately on order creation failure
      if (error || !data?.success) {
        console.error('❌ Order creation failed - stopping checkout flow:', error || data);
        const errorMessage = error?.message || data?.error || 'Order creation failed';
        const errorCode = data?.code || 'ORDER_CREATION_FAILED';
        throw new Error(`${errorMessage} [${errorCode}]`);
      }
      console.log('🔄 Raw server response:', data);

      // Try to parse response, prioritizing backend-returned amounts
      let parsedData;
      try {
        parsedData = normalizePaymentResponse(data);
        console.log('✅ Parsed server response successfully:', parsedData);
      } catch (error) {
        console.warn('⚠️ Could not parse payment_url from response, proceeding to secure payment handler:', error);
        // Fall back to minimal order data without payment_url
        parsedData = {
          order_id: data?.order_id,
          order_number: data?.order_number,
          amount: data?.amount || total,
          // Prioritize backend amount
          customer_email: sanitizedData.customer.email,
          success: true
        };
      }

      // 🔧 CRITICAL: Use backend-returned amount if available
      const authoritativeAmount = data?.amount || parsedData?.amount || total;
      console.log('💰 Amount prioritization:', {
        client_calculated: total,
        backend_returned: data?.amount,
        authoritative_amount: authoritativeAmount,
        items_subtotal: data?.items_subtotal,
        delivery_fee: data?.delivery_fee
      });

      // Handle direct payment redirection from backend
      if (data?.payment?.authorization_url || data?.authorization_url) {
        const paymentUrl = data.payment?.authorization_url || data.authorization_url;
        console.log('🔗 Redirecting to payment URL:', paymentUrl);

        // Save state before redirecting  
        savePrePaymentState(sanitizedData, checkoutStep, deliveryFee, 'direct_redirect');

        // Close dialog immediately and redirect to payment
        onClose();
        clearCart();
        window.location.href = paymentUrl;
        return;
      }

      // Note: Delivery schedule is now saved atomically in the backend during order creation

      // Close dialog and redirect directly to payment callback page with processing state
      onClose();
      clearCart();

      // Store payment reference for callback page
      sessionStorage.setItem('paystack_payment_reference', data?.reference || parsedData?.reference || '');
      sessionStorage.setItem('payment_order_id', parsedData?.order_id || data?.order?.id || '');

      // Set payment data for PaystackPaymentHandler to initialize securely
      setPaymentData({
        orderId: parsedData?.order_id || data?.order?.id,
        orderNumber: parsedData?.order_number || data?.order?.order_number,
        amount: authoritativeAmount,
        email: sanitizedData.customer.email,
        successUrl: `${window.location.origin}/payment-callback`,
        cancelUrl: window.location.href
      });

      // Navigate to callback page immediately to show clean processing state
      navigate('/payment-callback?status=processing');
      setIsSubmitting(false);
      logPaymentAttempt(sanitizedData, 'success');
    } catch (error: any) {
      console.error('🚨 Checkout submission error:', error);
      setIsSubmitting(false);

      // 🔧 CIRCUIT BREAKER: Increment failure count and activate if needed
      const newFailedAttempts = failedAttempts + 1;
      setFailedAttempts(newFailedAttempts);
      if (newFailedAttempts >= 3) {
        setCircuitBreakerActive(true);
        // Reset circuit breaker after 5 minutes
        setTimeout(() => {
          setCircuitBreakerActive(false);
          setFailedAttempts(0);
        }, 5 * 60 * 1000);
      }

      // Enhanced error handling with safe message extraction
      const errorMessage = safeErrorMessage(error);

      // Map specific errors to user-friendly messages
      let userFriendlyMessage: string;
      if (errorMessage.includes('ORDER_CREATION_FAILED') || errorMessage.includes('INVALID_ORDER_DATA')) {
        userFriendlyMessage = 'Order creation failed. Please check your details and try again.';
      } else if (errorMessage.includes('CUSTOMER_ERROR')) {
        userFriendlyMessage = 'There was an issue with customer information. Please verify your details.';
      } else if (errorMessage.includes('Payment initialization incomplete - missing authorization URL from server')) {
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
      logPaymentAttempt(null, 'failure');
      toast({
        title: "Checkout Error",
        description: userFriendlyMessage,
        variant: "destructive"
      });
    }
  };
  const handlePaymentSuccess = useCallback((reference: string) => {
    console.log('🎉 Payment success callback triggered with reference:', reference);

    // Save states and mark checkout progress when we get valid reference
    if (reference && reference.startsWith('txn_')) {
      savePrePaymentState(formData, checkoutStep, deliveryFee, reference);
      markCheckoutInProgress(reference);
    }
    markPaymentCompleted();
    clearCart();
    clearRecoveryState();
    onClose();
    toast({
      title: "Payment Successful!",
      description: "Your order has been confirmed. Check your email for details."
    });
    navigate('/orders');
  }, [formData, checkoutStep, deliveryFee, savePrePaymentState, markCheckoutInProgress, markPaymentCompleted, clearCart, clearRecoveryState, onClose, navigate]);

  // Validation
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPhone = (phone: string) => /^[\d\s\-\+\(\)]{10,}$/.test(phone);

  // Terms and conditions state
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsRequired, setTermsRequired] = useState(false);
  const [termsContent, setTermsContent] = useState('');
  const [showTermsDialog, setShowTermsDialog] = useState(false);

  // Load terms settings on mount
  useEffect(() => {
    const loadTermsSettings = async () => {
      try {
        const {
          data: requireTermsData
        } = await supabase.from('content_management').select('content').eq('key', 'legal_require_terms_acceptance').single();
        const {
          data: termsContentData
        } = await supabase.from('content_management').select('content, is_published').eq('key', 'legal_terms').single();
        if (requireTermsData?.content === 'true' && termsContentData?.is_published) {
          setTermsRequired(true);
          setTermsContent(termsContentData.content || '');
        }
      } catch (error) {
        console.log('Terms settings not configured or error loading:', error);
      }
    };
    loadTermsSettings();
  }, []);
  const canProceedToDetails = useMemo(() => {
    if (checkoutStep !== 'details') return false;
    const baseValidation = formData.customer_name.trim() && isValidEmail(formData.customer_email) && isValidPhone(formData.customer_phone) && formData.delivery_date && formData.delivery_time_slot; // Required for both delivery and pickup

    // Terms validation - only required if admin enabled it
    const termsValidation = !termsRequired || termsAccepted;
    if (formData.fulfillment_type === 'delivery') {
      // Make city and postal code optional, delivery schedule mandatory
      const deliveryValidation = baseValidation && formData.delivery_address.address_line_1.trim() && formData.delivery_address.state.trim() && deliveryZone;
      return deliveryValidation && termsValidation;
    } else {
      // For pickup, require pickup point selection
      return baseValidation && pickupPoint && termsValidation;
    }
  }, [formData, deliveryZone, pickupPoint, checkoutStep, termsRequired, termsAccepted]);
  const renderAuthStep = () => <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Complete Your Order</h3>
        <p className="text-muted-foreground">
          {items.length} item{items.length > 1 ? 's' : ''} • ₦{total.toLocaleString()}
        </p>
      </div>
      
      <GuestOrLoginChoice 
        onContinueAsGuest={handleContinueAsGuest} 
        onLogin={handleLogin} 
        totalAmount={total} 
      />
    </div>;
  const renderDetailsStep = () => <div className="space-y-6">
      <div className="space-y-4">
        {!isAuthenticated && <div className="flex items-center justify-between md:hidden mb-4">
            <Button variant="ghost" size="sm" onClick={() => setCheckoutStep('auth')} className="flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          </div>}

        {/* Customer Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="customer_name">Full Name *</Label>
              <Input 
                id="customer_name" 
                value={formData.customer_name} 
                onChange={e => handleFormChange('customer_name', e.target.value)} 
                placeholder="Enter your full name" 
                required 
                className="h-10" 
                readOnly={isAuthenticated && !!(profile as any)?.name}
              />
            </div>
            <div>
              <Label htmlFor="customer_email">Email *</Label>
              <Input 
                id="customer_email" 
                type="email" 
                value={formData.customer_email} 
                onChange={e => handleFormChange('customer_email', e.target.value)} 
                placeholder="Enter your email" 
                required 
                className="h-10" 
                readOnly={isAuthenticated && !!(profile as any)?.email}
              />
            </div>
            <div>
              <Label htmlFor="customer_phone">Phone Number</Label>
              <Input 
                id="customer_phone" 
                type="tel" 
                value={formData.customer_phone} 
                onChange={e => handleFormChange('customer_phone', e.target.value)} 
                placeholder="Enter your phone number" 
                className="h-10" 
                readOnly={isAuthenticated && !!(profile as any)?.phone}
              />
            </div>
          </CardContent>
        </Card>

        {/* Order Scheduling - Required for both delivery and pickup */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              When do you need your order? *
            </CardTitle>
            <CardDescription>
              Select your preferred date and time for {formData.fulfillment_type === 'delivery' ? 'delivery' : 'pickup'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeliveryScheduler onScheduleChange={(date, timeSlot) => {
            handleFormChange('delivery_date', date);
            handleFormChange('delivery_time_slot', timeSlot);
          }} selectedDate={formData.delivery_date} selectedTimeSlot={formData.delivery_time_slot} showHeader={false} />
          </CardContent>
        </Card>

        {/* Fulfillment Type */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fulfillment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={formData.fulfillment_type} onValueChange={value => handleFormChange('fulfillment_type', value)} className="space-y-3">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="delivery" id="delivery" />
                <Label htmlFor="delivery" className="flex items-center gap-2 cursor-pointer">
                  <Truck className="w-4 h-4" />
                  Delivery
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pickup" id="pickup" />
                <Label htmlFor="pickup" className="flex items-center gap-2 cursor-pointer">
                  <MapPin className="w-4 h-4" />
                  Pickup
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Delivery Address */}
        {formData.fulfillment_type === 'delivery' && <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="address_line_1">Street Address *</Label>
                <Input id="address_line_1" value={formData.delivery_address.address_line_1} onChange={e => handleFormChange('delivery_address.address_line_1', e.target.value)} placeholder="Enter street address" required className="h-10" />
              </div>
              <div>
                <Label htmlFor="address_line_2">Apartment, suite, etc. (optional)</Label>
                <Input id="address_line_2" value={formData.delivery_address.address_line_2} onChange={e => handleFormChange('delivery_address.address_line_2', e.target.value)} placeholder="Apartment, suite, etc." className="h-10" />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={formData.delivery_address.city} onChange={e => handleFormChange('delivery_address.city', e.target.value)} placeholder="City" className="h-10" />
                </div>
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input id="state" value={formData.delivery_address.state} onChange={e => handleFormChange('delivery_address.state', e.target.value)} placeholder="State" required className="h-10" />
                </div>
                
              </div>
              <div>
                <Label htmlFor="landmark">Landmark (optional)</Label>
                <Input id="landmark" value={formData.delivery_address.landmark} onChange={e => handleFormChange('delivery_address.landmark', e.target.value)} placeholder="Nearby landmark" className="h-10" />
              </div>
              <div>
                <Label htmlFor="delivery_instructions">Delivery Instructions (optional)</Label>
                <div className="relative">
                  <Input id="delivery_instructions" value={formData.special_instructions || ''} onChange={e => {
                const value = e.target.value.slice(0, 160); // Limit to 160 characters
                handleFormChange('special_instructions', value);
              }} placeholder="Gate code, building entrance, floor, special handling notes..." maxLength={160} className="h-10" />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-muted-foreground">
                      Help our drivers find you and deliver your order smoothly
                    </span>
                    <span className={`text-xs ${(formData.special_instructions?.length || 0) >= 150 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {formData.special_instructions?.length || 0}/160
                    </span>
                  </div>
                </div>
              </div>
              
              <DeliveryZoneDropdown selectedZoneId={deliveryZone?.id} onZoneSelect={(zoneId, fee) => {
            const zone = {
              id: zoneId,
              base_fee: fee
            };
            setDeliveryZone(zone);
          }} orderSubtotal={subtotal} />
            </CardContent>
          </Card>}

        {/* Pickup Point Selection */}
        {formData.fulfillment_type === 'pickup' && <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Pickup Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PickupPointSelector selectedPointId={pickupPoint?.id} onSelect={point => {
            setPickupPoint(point);
            handleFormChange('pickup_point_id', point?.id);
          }} />
            </CardContent>
          </Card>}

      </div>

      {lastPaymentError && <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Payment Error</p>
              <p className="text-sm text-destructive/80">{lastPaymentError}</p>
            </div>
          </div>
        </div>}
    </div>;
  const renderPaymentStep = () => <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Complete Payment</h3>
        <p className="text-muted-foreground">
          Secure payment powered by Paystack
        </p>
      </div>

      {paymentData && <PaystackPaymentHandler orderId={paymentData.orderId} amount={paymentData.amount} email={paymentData.email} orderNumber={paymentData.orderNumber} successUrl={paymentData.successUrl} cancelUrl={paymentData.cancelUrl} onSuccess={handlePaymentSuccess} onError={error => handlePaymentFailure({
      message: error
    })} onClose={() => setCheckoutStep('details')} />}
    </div>;
  return <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl h-[95vh] md:h-[90vh] overflow-hidden overscroll-contain p-0">
          {/* Mobile Header */}
          <div className="flex md:hidden items-center justify-between p-3 border-b bg-background flex-shrink-0">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
              <h2 className="text-base font-semibold">
                {checkoutStep === 'auth' && 'Complete Order'}
                {checkoutStep === 'details' && 'Checkout'}
                {checkoutStep === 'payment' && 'Payment'}
              </h2>
            </div>
          </div>

          {/* Mobile Order Summary */}
          <div className="md:hidden flex-shrink-0">
            <OrderSummaryCard items={items} subtotal={subtotal} deliveryFee={deliveryFee} total={total} collapsibleOnMobile={true} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 flex-1 min-h-0 overflow-hidden">
            {/* Desktop Left Panel - Order Details */}
            <div className="hidden lg:block lg:col-span-1 bg-muted/30 border-r overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                  <h2 className="text-lg font-semibold">Order Details</h2>
                </div>
                
                <OrderSummaryCard items={items} subtotal={subtotal} deliveryFee={deliveryFee} total={total} collapsibleOnMobile={false} className="shadow-none border-0 bg-transparent" />
              </div>
            </div>

            {/* Main Content Panel */}
            <div className="lg:col-span-2 flex flex-col min-h-0 overflow-hidden">
              {/* Desktop Header */}
              <div className="hidden md:block flex-shrink-0">
                <DialogHeader className="px-6 py-4 border-b">
                  <div className="flex items-center justify-between">
                    <DialogTitle className="text-xl">
                      {checkoutStep === 'auth' && 'Complete Your Order'}
                      {checkoutStep === 'details' && 'Delivery Details'}
                      {checkoutStep === 'payment' && 'Payment'}
                    </DialogTitle>
                    <DialogClose asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </DialogClose>
                  </div>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto px-3 md:px-6 py-3 md:py-6">
                {isLoading ? <div className="flex items-center justify-center py-12">
                    <div className="space-y-4 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="text-muted-foreground">Checking account...</p>
                    </div>
                  </div> : <>
                    {checkoutStep === 'auth' && renderAuthStep()}
                    {checkoutStep === 'details' && renderDetailsStep()}
                    {checkoutStep === 'payment' && renderPaymentStep()}
                  </>}
              </div>

              {/* Sticky Bottom Action */}
              {checkoutStep === 'details' && <div className="flex-shrink-0 p-3 md:p-6 border-t bg-background/80 backdrop-blur-sm">
                  {/* Terms and Conditions */}
                  {termsRequired && <div className="mb-3 flex items-start gap-2">
                      <input type="checkbox" id="terms-checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
                      <Label htmlFor="terms-checkbox" className="text-sm leading-relaxed cursor-pointer">
                        I agree to the{' '}
                        <button type="button" onClick={() => setShowTermsDialog(true)} className="text-primary hover:underline font-medium">
                          Terms and Conditions
                        </button>
                      </Label>
                    </div>}

                  <Button onClick={handleFormSubmit} disabled={!canProceedToDetails || isSubmitting || !isAuthenticated} className="w-full h-11 md:h-14 text-sm md:text-lg font-medium" size="lg">
                    {isSubmitting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : !isAuthenticated ? "Please log in to continue" : `Proceed to Payment • ₦${total.toLocaleString()}`}
                  </Button>
                  
                  {lastPaymentError && <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <p className="text-sm text-destructive">{lastPaymentError}</p>
                    </div>}
                </div>}
            </div>
          </div>

          {/* Terms and Conditions Dialog */}
          <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Terms and Conditions
                </DialogTitle>
              </DialogHeader>
              <div className="prose prose-sm max-w-none">
                {termsContent ? <SafeHtml className="prose prose-sm max-w-none">
                    {termsContent}
                  </SafeHtml> : <p>Terms and conditions content is being loaded...</p>}
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowTermsDialog(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                setTermsAccepted(true);
                setShowTermsDialog(false);
              }}>
                  I Agree
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
      
      {/* MOQ Adjustment Modal */}
      <MOQAdjustmentModal isOpen={showMOQModal} onClose={() => setShowMOQModal(false)} onConfirm={async () => {
      setShowMOQModal(false);
      toast({
        title: "Cart Updated",
        description: "Quantities have been adjusted to meet minimum order requirements. Proceeding to payment."
      });
      // Retry checkout after adjustment
      await handleFormSubmit();
    }} onCancel={() => setShowMOQModal(false)} adjustments={moqValidationResult?.adjustmentsMade || []} pricingImpact={moqValidationResult?.pricingImpact} />
    </>;
});
EnhancedCheckoutFlowComponent.displayName = 'EnhancedCheckoutFlowComponent';
export const EnhancedCheckoutFlow: React.FC<EnhancedCheckoutFlowProps> = props => <CheckoutErrorBoundary>
    <EnhancedCheckoutFlowComponent {...props} />
  </CheckoutErrorBoundary>;