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
import { Mail, Phone, MapPin, Truck, X, RefreshCw, AlertTriangle, ShoppingBag, Clock, ExternalLink, FileText, ChevronLeft } from "lucide-react";
import { DeliveryZoneDropdown } from "@/components/delivery/DeliveryZoneDropdown";
import { PickupPointSelector } from "@/components/delivery/PickupPointSelector";
import { GuestOrLoginChoice } from "./GuestOrLoginChoice";
import { DeliveryScheduler } from "./DeliveryScheduler";
import { OrderSummaryCard } from "./OrderSummaryCard";
import { PaystackPaymentHandler } from "@/components/payments/PaystackPaymentHandler";
import { storeRedirectUrl } from "@/utils/redirect";
import { useOrderProcessing } from "@/hooks/useOrderProcessing";
import '@/components/payments/payment-styles.css';
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
      return (
        <Dialog open>
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
        </Dialog>
      );
    }

    return this.props.children;
  }
}

const EnhancedCheckoutFlowComponent = React.memo<EnhancedCheckoutFlowProps>(({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { cart, clearCart, getCartTotal } = useCart();
  const items = cart.items || [];
  const { guestSession } = useGuestSession();
  const guestSessionId = guestSession?.sessionId;
  const { user, session, isAuthenticated, isLoading } = useCustomerAuth();
  const { profile } = useCustomerProfile();
  
  // Initialize checkout step based on authentication status
  const getInitialCheckoutStep = () => {
    if (isAuthenticated) return 'details';
    return 'auth';
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
  const [deliveryZone, setDeliveryZone] = useState<any>(null);
  const [pickupPoint, setPickupPoint] = useState<any>(null);
  const [lastPaymentError, setLastPaymentError] = useState<string | null>(null);

  // Initialize checkout state recovery
  const { 
    savePrePaymentState, 
    markPaymentCompleted, 
    clearState: clearRecoveryState,
    hasRecoverableState 
  } = useCheckoutStateRecovery();

  // Initialize order processing
  const { markCheckoutInProgress } = useOrderProcessing();

  const handleClose = () => {
    if (checkoutStep === 'payment' && paymentData) {
      // Don't close during payment process
      toast({
        title: "Payment in Progress",
        description: "Please complete your payment before closing.",
        variant: "destructive",
      });
      return;
    }
    onClose();
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
          description: "Your order has been confirmed.",
        });
      } else if (event.data.type === 'PAYMENT_FAILED') {
        console.log('Payment failed:', event.data.error);
        toast({
          title: "Payment Failed",
          description: "Please try again or contact support.",
          variant: "destructive",
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
      variant: "destructive",
    });
  }, []);

  // Remove the processOrder hook usage since it doesn't exist

  const handleFormSubmit = async () => {
    try {
      setIsSubmitting(true);
      setLastPaymentError(null);

      // Enhanced data sanitization and validation
      const sanitizedData = {
        customer_email: formData.customer_email.trim().toLowerCase(),
        customer_name: formData.customer_name.trim(),
        customer_phone: formData.customer_phone.trim(),
        fulfillment_type: formData.fulfillment_type,
        delivery_address: formData.fulfillment_type === 'delivery' ? formData.delivery_address : null,
        pickup_point_id: formData.fulfillment_type === 'pickup' ? formData.pickup_point_id : null,
        order_items: items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity
        })),
        total_amount: total,
        delivery_fee: deliveryFee,
        delivery_zone_id: deliveryZone?.id || null,
        delivery_schedule: formData.delivery_date ? {
          delivery_date: formData.delivery_date,
          delivery_time_start: formData.delivery_time_slot?.start_time || '09:00',
          delivery_time_end: formData.delivery_time_slot?.end_time || '17:00',
          is_flexible: false,
          special_instructions: formData.special_instructions || null
        } : null,
        payment_method: formData.payment_method,
        guest_session_id: guestSessionId,
        terms_accepted: termsRequired ? termsAccepted : undefined,
        timestamp: new Date().toISOString()
      };

      console.log('📦 Submitting checkout data:', sanitizedData);

      // Call Supabase edge function
      const { data, error } = await supabase.functions.invoke('process-checkout', {
        body: sanitizedData
      });

      if (error) throw error;

      console.log('🔄 Raw server response:', data);

      // Use backend-returned order data
      const orderData = {
        order_id: data?.order_id,
        order_number: data?.order_number,
        authoritative_amount: data?.amount || total, // Backend amount is authoritative
        customer_email: sanitizedData.customer_email,
        success: true
      };
      
      console.log('💰 Order created successfully:', {
        client_calculated: total,
        backend_returned: data?.amount,
        authoritative_amount: orderData.authoritative_amount,
        items_subtotal: data?.items_subtotal,
        delivery_fee: data?.delivery_fee
      });

      // GUARDRAIL: Client-side delivery schedule verification (non-blocking)
      if (orderData?.order_id && sanitizedData.delivery_schedule) {
        console.log('🔍 [GUARDRAIL] Verifying delivery schedule was persisted (client-side, non-blocking)...');
        try {
          const { upsertDeliverySchedule } = await import('@/api/deliveryScheduleApi');
          await upsertDeliverySchedule({
            order_id: orderData.order_id,
            delivery_date: sanitizedData.delivery_schedule.delivery_date,
            delivery_time_start: sanitizedData.delivery_schedule.delivery_time_start,
            delivery_time_end: sanitizedData.delivery_schedule.delivery_time_end,
            is_flexible: sanitizedData.delivery_schedule.is_flexible || false,
            special_instructions: sanitizedData.delivery_schedule.special_instructions || null
          });
          console.log('✅ [GUARDRAIL] Schedule upserted successfully');
          toast({
            title: "Schedule saved",
            description: "Your delivery schedule has been confirmed."
          });
        } catch (error) {
          console.error('🛡️ [GUARDRAIL] Fallback failed:', error);
          toast({
            title: "Processing delivery schedule",
            description: "We'll finalize your delivery window after payment."
          });
        }
      }
      
      // Set payment data for PaystackPaymentHandler to initialize securely
      setPaymentData({
        orderId: orderData.order_id,
        orderNumber: orderData.order_number,
        amount: orderData.authoritative_amount, // Use authoritative amount from backend
        email: sanitizedData.customer_email,
        successUrl: `${window.location.origin}/payment-callback`,
        cancelUrl: window.location.href
      });
      setCheckoutStep('payment');
      setIsSubmitting(false);
      
      logPaymentAttempt(sanitizedData, 'success');
      
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
      description: "Your order has been confirmed. Check your email for details.",
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
        const { data: requireTermsData } = await supabase
          .from('content_management')
          .select('content')
          .eq('key', 'legal_require_terms_acceptance')
          .single();

        const { data: termsContentData } = await supabase
          .from('content_management')
          .select('content, is_published')
          .eq('key', 'legal_terms')
          .single();

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
    
    const baseValidation = 
      formData.customer_name.trim() &&
      isValidEmail(formData.customer_email) &&
      isValidPhone(formData.customer_phone);

    // Terms validation - only required if admin enabled it
    const termsValidation = !termsRequired || termsAccepted;

    if (formData.fulfillment_type === 'delivery') {
      // Make city and postal code optional, delivery schedule mandatory
      const deliveryValidation = baseValidation &&
        formData.delivery_address.address_line_1.trim() &&
        formData.delivery_address.state.trim() &&
        deliveryZone &&
        formData.delivery_date && 
        formData.delivery_time_slot;
      
      return deliveryValidation && termsValidation;
    } else {
      return baseValidation && pickupPoint && termsValidation;
    }
  }, [formData, deliveryZone, pickupPoint, checkoutStep, termsRequired, termsAccepted]);

  const renderAuthStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Complete Your Order</h3>
        <p className="text-muted-foreground">
          {items.length} item{items.length > 1 ? 's' : ''} • ₦{total.toLocaleString()}
        </p>
      </div>
      
      <GuestOrLoginChoice
        onContinueAsGuest={() => setCheckoutStep('details')}
        onLogin={() => {
          storeRedirectUrl('/checkout');
          onClose();
          navigate('/auth');
        }}
        totalAmount={total}
      />
    </div>
  );

  const renderDetailsStep = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        {!isAuthenticated && (
          <div className="flex items-center justify-between md:hidden mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCheckoutStep('auth')}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
        )}

        {/* Customer Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="customer_name">Full Name *</Label>
                <Input
                  id="customer_name"
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => handleFormChange('customer_name', e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="customer_email">Email Address *</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => handleFormChange('customer_email', e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="customer_phone">Phone Number *</Label>
              <Input
                id="customer_phone"
                type="tel"
                value={formData.customer_phone}
                onChange={(e) => handleFormChange('customer_phone', e.target.value)}
                placeholder="Enter your phone number"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Fulfillment Type */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fulfillment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={formData.fulfillment_type}
              onValueChange={(value) => handleFormChange('fulfillment_type', value)}
              className="space-y-3"
            >
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
        {formData.fulfillment_type === 'delivery' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="address_line_1">Street Address *</Label>
                <Input
                  id="address_line_1"
                  value={formData.delivery_address.address_line_1}
                  onChange={(e) => handleFormChange('delivery_address.address_line_1', e.target.value)}
                  placeholder="Enter street address"
                  required
                />
              </div>
              <div>
                <Label htmlFor="address_line_2">Apartment, suite, etc. (optional)</Label>
                <Input
                  id="address_line_2"
                  value={formData.delivery_address.address_line_2}
                  onChange={(e) => handleFormChange('delivery_address.address_line_2', e.target.value)}
                  placeholder="Apartment, suite, etc."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.delivery_address.city}
                    onChange={(e) => handleFormChange('delivery_address.city', e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={formData.delivery_address.state}
                    onChange={(e) => handleFormChange('delivery_address.state', e.target.value)}
                    placeholder="State"
                    required
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={formData.delivery_address.postal_code}
                    onChange={(e) => handleFormChange('delivery_address.postal_code', e.target.value)}
                    placeholder="Postal code"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="landmark">Landmark (optional)</Label>
                <Input
                  id="landmark"
                  value={formData.delivery_address.landmark}
                  onChange={(e) => handleFormChange('delivery_address.landmark', e.target.value)}
                  placeholder="Nearby landmark"
                />
              </div>
              
              <DeliveryZoneDropdown
                selectedZoneId={deliveryZone?.id}
                onZoneSelect={(zoneId, fee) => {
                  const zone = { id: zoneId, base_fee: fee };
                  setDeliveryZone(zone);
                }}
                orderSubtotal={subtotal}
              />
            </CardContent>
          </Card>
        )}

        {/* Pickup Point Selection */}
        {formData.fulfillment_type === 'pickup' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Pickup Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PickupPointSelector
                selectedPointId={pickupPoint?.id}
                onSelect={(point) => {
                  setPickupPoint(point);
                  handleFormChange('pickup_point_id', point?.id);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Delivery Scheduling */}
        {formData.fulfillment_type === 'delivery' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Delivery Schedule *
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DeliveryScheduler
                variant="horizontal"
                onScheduleChange={(date, timeSlot) => {
                  handleFormChange('delivery_date', date);
                  handleFormChange('delivery_time_slot', timeSlot);
                }}
                selectedDate={formData.delivery_date}
                selectedTimeSlot={formData.delivery_time_slot}
                showHeader={false}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {lastPaymentError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Payment Error</p>
              <p className="text-sm text-destructive/80">{lastPaymentError}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPaymentStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Complete Payment</h3>
        <p className="text-muted-foreground">
          Secure payment powered by Paystack
        </p>
      </div>

      {paymentData && (
        <PaystackPaymentHandler
          orderId={paymentData.orderId}
          amount={paymentData.amount}
          email={paymentData.email}
          orderNumber={paymentData.orderNumber}
          successUrl={paymentData.successUrl}
          cancelUrl={paymentData.cancelUrl}
          onSuccess={handlePaymentSuccess}
          onError={(error) => handlePaymentFailure({ message: error })}
          onClose={() => setCheckoutStep('details')}
        />
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl h-[95vh] md:h-[90vh] overflow-hidden overscroll-contain p-0">
        {/* Mobile Header */}
        <div className="flex md:hidden items-center justify-between p-4 border-b bg-background flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold">
              {checkoutStep === 'auth' && 'Complete Order'}
              {checkoutStep === 'details' && 'Checkout'}
              {checkoutStep === 'payment' && 'Payment'}
            </h2>
          </div>
        </div>

        {/* Mobile Order Summary */}
        <div className="md:hidden flex-shrink-0">
          <OrderSummaryCard
            items={items}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            total={total}
            collapsibleOnMobile={true}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 flex-1 min-h-0 overflow-hidden">
          {/* Desktop Left Panel - Order Details */}
          <div className="hidden lg:block lg:col-span-1 bg-muted/30 border-r overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-semibold">Order Details</h2>
              </div>
              
              <OrderSummaryCard
                items={items}
                subtotal={subtotal}
                deliveryFee={deliveryFee}
                total={total}
                collapsibleOnMobile={false}
                className="shadow-none border-0 bg-transparent"
              />
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

            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="space-y-4 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground">Checking account...</p>
                  </div>
                </div>
              ) : (
                <>
                  {checkoutStep === 'auth' && renderAuthStep()}
                  {checkoutStep === 'details' && renderDetailsStep()}
                  {checkoutStep === 'payment' && renderPaymentStep()}
                </>
              )}
            </div>

            {/* Sticky Bottom Action */}
            {checkoutStep === 'details' && (
              <div className="flex-shrink-0 p-4 md:p-6 border-t bg-background/80 backdrop-blur-sm">
                {/* Terms and Conditions */}
                {termsRequired && (
                  <div className="mb-4 flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="terms-checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                    <Label htmlFor="terms-checkbox" className="text-sm leading-relaxed cursor-pointer">
                      I agree to the{' '}
                      <button
                        type="button"
                        onClick={() => setShowTermsDialog(true)}
                        className="text-primary hover:underline font-medium"
                      >
                        Terms and Conditions
                      </button>
                    </Label>
                  </div>
                )}

                <Button
                  onClick={handleFormSubmit}
                  disabled={!canProceedToDetails || isSubmitting}
                  className="w-full h-12 md:h-14 text-base md:text-lg font-medium"
                  size="lg"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Proceed to Payment • ₦{total.toLocaleString()}
                </Button>
                
                {lastPaymentError && (
                  <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive">{lastPaymentError}</p>
                  </div>
                )}
              </div>
            )}
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
              {termsContent ? (
                <div dangerouslySetInnerHTML={{ __html: termsContent }} />
              ) : (
                <p>Terms and conditions content is being loaded...</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowTermsDialog(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setTermsAccepted(true);
                  setShowTermsDialog(false);
                }}
              >
                I Agree
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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