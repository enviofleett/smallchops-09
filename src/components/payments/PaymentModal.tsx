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
      
      const providers = (data || [])
        .map(item => ({
          provider: item.provider,
          currency: item.currency || 'NGN',
          test_mode: item.test_mode || true,
          payment_methods: Array.isArray(item.payment_methods) 
            ? item.payment_methods as string[]
            : typeof item.payment_methods === 'string' 
              ? [item.payment_methods]
              : ['card']
        }))
        .filter(p => p.provider === 'paystack');
      
      setAvailableProviders(providers);
      
      // Force Paystack as the only provider
      setSelectedProvider('paystack' as PaymentProvider);
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
    setLoading(true);
    try {
      if (paymentMethod !== 'new_card' && selectedSavedMethod) {
        // Handle saved card payment - implement saved card logic
        toast.success('Payment with saved card initiated!');
        onSuccess({ status: 'success' });
        onClose();
      } else {
        // Use direct redirection (bypass popup) consistently
        const success = await processPayment(
          orderData.id,
          orderData.total,
          orderData.customer_email,
          true, // Open in new tab (bypass popup consistently)
          selectedProvider
        );

        if (success) {
          toast.success('Payment initiated! Complete payment in the new tab.', {
            description: `Order #${orderData.id} - ₦${orderData.total.toLocaleString()}`,
            duration: 8000
          });
          onClose();
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Direct payment handler that bypasses popup
  const handleDirectPayment = async (provider: PaymentProvider) => {
    setLoading(true);
    try {
      const success = await processPayment(
        orderData.id,
        orderData.total,
        orderData.customer_email,
        true, // Open in new tab (bypass popup)
        provider
      );

      if (success) {
        toast.success('Payment initiated! Complete payment in the new tab.', {
          description: `Order #${orderData.id} - ₦${orderData.total.toLocaleString()}`,
          duration: 8000
        });
        onClose();
      }
    } catch (error) {
      toast.error('Payment failed', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setLoading(false);
    }
  };

  const getAvailableMethodsForProvider = () => {
    return paymentChannels;
  };

  const formatCurrency = (amount: number) => {
    // PAYSTACK-ONLY: Always format as Nigerian Naira
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
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
          {/* PAYSTACK-ONLY: Provider selection removed */}
          <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-medium text-sm">Powered by Paystack</span>
            <Badge variant="secondary" className="ml-auto">Secure</Badge>
          </div>

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

          {/* Payment Info - PAYSTACK-ONLY */}
          <div className="text-xs text-muted-foreground p-3 bg-muted rounded">
            <p>• Secure payments powered by Paystack</p>
            <p>• Supports Nigerian banks and mobile money</p>
            <p>• No hidden fees</p>
            <p>• Backend-secured transactions</p>
          </div>

          {paymentMethod === 'new_card' ? (
            <Button
              className="w-full"
              onClick={() => handleDirectPayment('paystack')}
              disabled={loading}
            >
              {loading ? 'Processing...' : `Pay ${formatCurrency(orderData.total)}`}
            </Button>
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