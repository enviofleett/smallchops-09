import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { paystackService } from '@/lib/paystack';
import { toast } from '@/hooks/use-toast';

interface PaystackButtonProps {
  email: string;
  amount: number;
  orderId: string;
  customerName?: string;
  customerPhone?: string;
  metadata?: Record<string, any>;
  onSuccess: (reference: string, transaction: any) => void;
  onError: (error: string) => void;
  onClose?: () => void;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  channels?: string[];
}

export const PaystackButton: React.FC<PaystackButtonProps> = ({
  email,
  amount,
  orderId,
  customerName,
  customerPhone,
  metadata = {},
  onSuccess,
  onError,
  className,
  disabled,
  children,
  channels = ['card', 'bank', 'ussd', 'mobile_money']
}) => {
  const [loading, setLoading] = useState(false);

  const initializePayment = useCallback(async () => {
    if (!email || !amount || amount <= 0) {
      toast({ title: 'Payment Error', description: 'Invalid payment details', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const reference = paystackService.generateReference();
      const callbackUrl = `${window.location.origin}/payment/callback?order_id=${orderId}`;

      const response = await paystackService.initializeTransaction({
        email,
        amount: paystackService.formatAmount(amount),
        reference,
        callback_url: callbackUrl,
        channels,
        metadata: {
          orderId,
          customerName,
          customerPhone,
          ...metadata,
        },
      });

      const url = response?.authorization_url || response?.data?.authorization_url;
      if (!url) throw new Error('Authorization URL not returned');

      try { sessionStorage.setItem('paystack_last_reference', reference); localStorage.setItem('paystack_last_reference', reference); } catch {}

      // Direct redirect (no iframe) to avoid CORS/CSP issues
      try {
        if (window.top && window.top !== window.self) {
          (window.top as Window).location.href = url;
        } else {
          window.location.href = url;
        }
      } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
      }

      // Optionally notify caller that we got an auth URL (no txn yet)
      onSuccess(reference, { authorization_url: url });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment initialization failed';
      console.error('Payment initialization error:', errorMessage);
      toast({ title: 'Payment Error', description: errorMessage, variant: 'destructive' });
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [email, amount, orderId, customerName, customerPhone, metadata, channels, onSuccess, onError]);

  return (
    <Button onClick={initializePayment} disabled={disabled || loading} className={className}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children || `Pay ${paystackService.formatCurrency(amount)}`}
    </Button>
  );
};
