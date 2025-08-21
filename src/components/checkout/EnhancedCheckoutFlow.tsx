import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Clock, AlertCircle, Package, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { createOrderWithPayment } from '@/utils/paymentOrderCreation';
import { OrderSummary } from './OrderSummary';
import { CustomerInformationForm } from './CustomerInformationForm';
import { FulfillmentOptionsForm } from './FulfillmentOptionsForm';
import { DeliveryScheduleForm } from './DeliveryScheduleForm';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { TermsAndConditions } from './TermsAndConditions';

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

export const EnhancedCheckoutFlow: React.FC = () => {
  const { items, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [state, setState] = useState<CheckoutState>({
    step: 'customer',
    customerInfo: null,
    fulfillment: null,
    deliverySchedule: null,
    paymentMethod: 'paystack',
    termsAccepted: false,
  });

  // Pre-fill customer info if user is authenticated
  useEffect(() => {
    if (user && !state.customerInfo) {
      setState(prev => ({
        ...prev,
        customerInfo: {
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
          email: user.email || '',
          phone: user.user_metadata?.phone || ''
        }
      }));
    }
  }, [user, state.customerInfo]);

  const handleCustomerInfoSubmit = (customerInfo: CheckoutState['customerInfo']) => {
    setState(prev => ({ ...prev, customerInfo, step: 'fulfillment' }));
  };

  const handleFulfillmentSubmit = (fulfillment: CheckoutState['fulfillment']) => {
    setState(prev => ({ 
      ...prev, 
      fulfillment,
      step: fulfillment?.type === 'delivery' ? 'schedule' : 'payment'
    }));
  };

  const handleScheduleSubmit = (schedule: CheckoutState['deliverySchedule']) => {
    setState(prev => ({ ...prev, deliverySchedule: schedule, step: 'payment' }));
  };

  const handlePaymentMethodSelect = (method: string) => {
    setState(prev => ({ ...prev, paymentMethod: method, step: 'review' }));
  };

  const handleTermsAcceptance = (accepted: boolean) => {
    setState(prev => ({ ...prev, termsAccepted: accepted }));
  };

  const processCheckout = async () => {
    if (!state.customerInfo || !state.fulfillment || !state.termsAccepted) {
      toast.error('Please complete all required fields');
      return;
    }

    setIsProcessing(true);
    setState(prev => ({ ...prev, step: 'processing' }));

    try {
      console.log('🛒 Starting enhanced checkout process...');

      // Use the unified checkout that already handles payment initialization
      const checkoutResult = await createOrderWithPayment({
        items: items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.unit_price,
          customization_items: item.customizations
        })),
        customerInfo: state.customerInfo,
        totalAmount,
        fulfillmentType: state.fulfillment.type,
        deliveryAddress: state.fulfillment.address,
        pickupPointId: state.fulfillment.pickupPointId,
        deliveryZoneId: state.fulfillment.deliveryZoneId,
        deliverySchedule: state.deliverySchedule || undefined
      });

      console.log('✅ Checkout completed successfully:', {
        orderId: checkoutResult.order?.id,
        orderNumber: checkoutResult.order?.order_number,
        hasPaymentUrl: !!checkoutResult.paymentUrl
      });

      // Update state with order details
      setState(prev => ({
        ...prev,
        orderId: checkoutResult.order?.id,
        orderNumber: checkoutResult.order?.order_number,
        step: 'complete'
      }));

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
          description: `Order #${checkoutResult.order?.order_number} - ₦${totalAmount.toLocaleString()}`
        });
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

      // Reset to review step on error
      setState(prev => ({ ...prev, step: 'review' }));
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStep = () => {
    switch (state.step) {
      case 'customer':
        return (
          <CustomerInformationForm
            initialData={state.customerInfo}
            onSubmit={handleCustomerInfoSubmit}
          />
        );
      case 'fulfillment':
        return (
          <FulfillmentOptionsForm
            onSubmit={handleFulfillmentSubmit}
          />
        );
      case 'schedule':
        return (
          <DeliveryScheduleForm
            onSubmit={handleScheduleSubmit}
          />
        );
      case 'payment':
        return (
          <PaymentMethodSelector
            onSelect={handlePaymentMethodSelect}
          />
        );
      case 'review':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Review Your Order
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Order Summary */}
                <OrderSummary />
                
                {/* Terms and Conditions */}
                <TermsAndConditions
                  accepted={state.termsAccepted}
                  onAcceptanceChange={handleTermsAcceptance}
                />

                {/* Complete Order Button */}
                <Button
                  onClick={processCheckout}
                  disabled={!state.termsAccepted || isProcessing}
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
                      Complete Order - ₦{totalAmount.toLocaleString()}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        );
      case 'processing':
        return (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Processing Your Order</h3>
              <p className="text-muted-foreground text-center">
                Please wait while we create your order and initialize payment...
              </p>
            </CardContent>
          </Card>
        );
      case 'complete':
        return (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
              <h3 className="text-2xl font-bold text-green-600 mb-2">Order Created!</h3>
              <p className="text-muted-foreground text-center mb-4">
                Order #{state.orderNumber} has been created successfully.
                Complete your payment to confirm the order.
              </p>
              <Badge variant="outline" className="text-lg px-4 py-2">
                Total: ₦{totalAmount.toLocaleString()}
              </Badge>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  const getSteps = () => [
    { key: 'customer', title: 'Customer Info', icon: Package },
    { key: 'fulfillment', title: 'Delivery', icon: Package },
    { key: 'schedule', title: 'Schedule', icon: Clock },
    { key: 'payment', title: 'Payment', icon: CreditCard },
    { key: 'review', title: 'Review', icon: CheckCircle },
  ];

  const getStepNumber = (step: CheckoutState['step']): number => {
    const stepMap: Record<string, number> = {
      customer: 1,
      fulfillment: 2,
      schedule: 3,
      payment: 4,
      review: 5,
      processing: 5,
      complete: 5,
    };
    return stepMap[step] || 1;
  };

  const getCurrentStepIndex = (): number => {
    const steps = getSteps();
    return steps.findIndex(s => s.key === state.step);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Checkout</h1>
            <Badge variant={state.step === 'complete' ? 'default' : 'outline'}>
              {state.step === 'complete' ? 'Complete' : `Step ${getStepNumber(state.step)} of 5`}
            </Badge>
          </div>
          
          {/* Step indicator */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            {getSteps().map((step, index) => (
              <React.Fragment key={step.key}>
                <div className={`flex items-center space-x-2 whitespace-nowrap px-3 py-2 rounded-lg ${
                  getCurrentStepIndex() >= index 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <step.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{step.title}</span>
                </div>
                {index < getSteps().length - 1 && (
                  <div className="w-2 h-0.5 bg-border" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step content */}
        {renderStep()}
      </div>
    </div>
  );
};
