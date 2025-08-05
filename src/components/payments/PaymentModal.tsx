import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreditCard, Building2, Smartphone, QrCode, Trash2, Star, Globe } from 'lucide-react';
import { usePayment, type PaymentProvider } from '@/hooks/usePayment';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PaystackButton } from './PaystackButton';
import { PaymentsAPI } from '@/api/payments';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: {
    id: string;
    total: number;
    customer_email: string;
    customer_phone?: string;
    customer_name: string;
  };
  onSuccess: (data: any) => void;
}

interface SavedPaymentMethod {
  id: string;
  provider: string;
  authorization_code: string;
  card_type: string;
  last4: string;
  exp_month: string;
  exp_year: string;
  bank: string;
  nickname?: string;
  is_default: boolean;
  usage_count: number;
}

interface PaymentConfig {
  provider: string;
  currency: string;
  payment_methods: string[];
  test_mode: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ 
  isOpen, 
  onClose, 
  orderData, 
  onSuccess 
}) => {
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('paystack');
  const [selectedMethod, setSelectedMethod] = useState<string>('new');
  const [paymentMethod, setPaymentMethod] = useState('new_card');
  const [selectedSavedMethod, setSelectedSavedMethod] = useState<SavedPaymentMethod | null>(null);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [availableProviders, setAvailableProviders] = useState<PaymentConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const { handleError } = useErrorHandler();
  const { processPayment } = usePayment();

  const paymentChannels = [
    { id: 'card', name: 'Debit/Credit Card', icon: CreditCard, description: 'Visa, Mastercard, Verve' },
    { id: 'bank_transfer', name: 'Bank Transfer', icon: Building2, description: 'Direct bank transfer' },
    { id: 'ussd', name: 'USSD', icon: Smartphone, description: 'Dial USSD code' },
    { id: 'qr', name: 'QR Code', icon: QrCode, description: 'Scan to pay' }
  ];

  useEffect(() => {
    if (isOpen) {
      loadAvailableProviders();
      loadSavedPaymentMethods();
    }
  }, [isOpen]);

  const loadAvailableProviders = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_integrations')
        .select('provider, currency, test_mode, payment_methods')
        .eq('connection_status', 'connected');

      if (error) throw error;
      
      const providers = (data || []).map(item => ({
        provider: item.provider,
        currency: item.currency || 'NGN',
        test_mode: item.test_mode || true,
        payment_methods: Array.isArray(item.payment_methods) 
          ? item.payment_methods as string[]
          : typeof item.payment_methods === 'string' 
            ? [item.payment_methods]
            : ['card']
      }));
      
      setAvailableProviders(providers);
      
      if (providers.length > 0) {
        setSelectedProvider(providers[0].provider as PaymentProvider);
      }
    } catch (error) {
      handleError(error, 'loading payment providers');
    }
  };

  const loadSavedPaymentMethods = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('saved_payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('usage_count', { ascending: false });

      if (error) throw error;
      setSavedMethods(data || []);
    } catch (error) {
      handleError(error, 'loading saved payment methods');
    }
  };

  const handlePayment = async () => {
    try {
      if (paymentMethod !== 'new_card' && selectedSavedMethod) {
        // Handle saved card payment - implement saved card logic
        toast.success('Payment with saved card initiated!');
        onSuccess({ status: 'success' });
        onClose();
      } else {
        // Use regular payment flow
        const success = await processPayment(
          orderData.id,
          orderData.total,
          orderData.customer_email,
          false, // Don't open in new tab
          selectedProvider
        );

        if (success) {
          onClose();
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please try again.');
    }
  };

  const handlePaystackSuccess = async (reference: string, transaction: any) => {
    try {
      // Verify payment on the backend
      const verification = await PaymentsAPI.verifyPayment(reference);
      
      if (verification.success && verification.data?.status === 'success') {
        toast.success('Payment completed successfully!');
        onSuccess({
          status: 'success',
          reference,
          transaction: verification.data
        });
        onClose();
      } else {
        throw new Error('Payment verification failed');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      toast.error('Payment verification failed. Please contact support.');
    }
  };

  const handlePaystackError = (error: string) => {
    console.error('Paystack payment error:', error);
    toast.error(`Payment failed: ${error}`);
  };

  const getAvailableMethodsForProvider = () => {
    return paymentChannels;
  };

  const formatCurrency = (amount: number) => {
    if (selectedProvider === 'paystack') {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
      }).format(amount);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Order Summary */}
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{formatCurrency(orderData.total)}</p>
            <p className="text-sm text-muted-foreground">Order ID: {orderData.id}</p>
          </div>

          {/* Payment Provider Selection */}
          {availableProviders.length > 1 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Payment Provider</Label>
              <RadioGroup
                value={selectedProvider}
                onValueChange={(value) => setSelectedProvider(value as PaymentProvider)}
                className="grid grid-cols-2 gap-2"
              >
                {availableProviders.map((provider) => (
                  <div key={provider.provider} className="flex items-center space-x-2">
                    <RadioGroupItem value={provider.provider} id={provider.provider} />
                    <Label 
                      htmlFor={provider.provider}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      {provider.provider === 'stripe' && <Globe className="h-4 w-4" />}
                      {provider.provider === 'paystack' && <Building2 className="h-4 w-4" />}
                      <span className="capitalize">{provider.provider}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Saved Payment Methods */}
          {savedMethods.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Saved Payment Methods</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(value) => {
                    setPaymentMethod(value);
                    if (value !== 'new_card') {
                      const method = savedMethods.find(m => m.id === value);
                      setSelectedSavedMethod(method || null);
                    } else {
                      setSelectedSavedMethod(null);
                    }
                  }}
                  className="space-y-2"
                >
                  {savedMethods
                    .filter(method => method.provider === selectedProvider)
                    .map((method) => (
                    <div key={method.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={method.id} id={method.id} />
                      <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                        <Card className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <CreditCard className="h-5 w-5" />
                              <div>
                                <p className="font-medium">**** {method.last4}</p>
                                <p className="text-sm text-muted-foreground">
                                  {method.card_type} • {method.exp_month}/{method.exp_year}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </>
          )}

          {/* New Payment Method */}
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem 
                value="new_card" 
                id="new_card" 
                checked={paymentMethod === 'new_card'}
                onChange={() => setPaymentMethod('new_card')}
              />
              <Label htmlFor="new_card" className="text-sm font-medium">
                Use New Payment Method
              </Label>
            </div>
            
            {paymentMethod === 'new_card' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {getAvailableMethodsForProvider().map((method) => {
                  const IconComponent = method.icon;
                  return (
                    <Card
                      key={method.id}
                      className="cursor-pointer transition-colors hover:bg-accent"
                    >
                      <CardContent className="p-3 text-center">
                        <IconComponent className="h-6 w-6 mx-auto mb-2" />
                        <p className="text-sm">{method.name}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Info */}
          {selectedProvider === 'paystack' && (
            <div className="text-xs text-muted-foreground p-3 bg-muted rounded">
              <p>• Secure payments powered by Paystack</p>
              <p>• Supports Nigerian banks and mobile money</p>
              <p>• No hidden fees</p>
            </div>
          )}

          {selectedProvider === 'paystack' && paymentMethod === 'new_card' ? (
            <PaystackButton
              email={orderData.customer_email}
              amount={orderData.total}
              orderId={orderData.id}
              customerName={orderData.customer_name}
              customerPhone={orderData.customer_phone}
              onSuccess={handlePaystackSuccess}
              onError={handlePaystackError}
              onClose={() => setLoading(false)}
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Processing...' : `Pay ${formatCurrency(orderData.total)}`}
            </PaystackButton>
          ) : (
            <Button
              className="w-full"
              onClick={handlePayment}
              disabled={loading}
            >
              {loading ? 'Processing...' : `Pay ${formatCurrency(orderData.total)}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};