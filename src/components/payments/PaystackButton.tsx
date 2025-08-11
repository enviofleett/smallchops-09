import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { paystackService, assertServerReference } from '@/lib/paystack';
import { toast } from 'sonner';

// Extend window object for Paystack
declare global {
  interface Window {
    PaystackPop: {
      setup: (config: any) => {
        openIframe: () => void;
      };
    };
  }
}

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
  onClose,
  className,
  disabled,
  children,
  channels = ['card', 'bank', 'ussd', 'mobile_money']
}) => {
  const [loading, setLoading] = useState(false);

  const initializePayment = useCallback(async () => {
    if (!email || !amount || amount <= 0) {
      toast.error('Invalid payment details');
      return;
    }

    setLoading(true);
    
    try {
      // Build callback URL
      const callbackUrl = `${window.location.origin}/payment/callback?order_id=${orderId}`;
      
      // Initialize transaction with backend
      const response = await paystackService.initializeTransaction({
        email,
        amount: paystackService.formatAmount(amount),
        callback_url: callbackUrl,
        channels,
        metadata: {
          orderId,
          customerName,
          customerPhone,
          ...metadata
        }
      });

      if (response.authorization_url) {
        // Open Paystack popup or redirect
        const config = await paystackService.getConfig();
        
        // Use the server-returned reference as the single source of truth
        const serverRef = response.reference;

        // Store reference immediately for callback recovery across tabs
        try {
          sessionStorage.setItem('paystack_last_reference', serverRef);
          localStorage.setItem('paystack_last_reference', serverRef);
        } catch {}

        try {
          assertServerReference(serverRef);
        } catch (e) {
          setLoading(false);
          console.warn('Invalid server reference, redirecting to authorization URL:', serverRef, e);
          // Fallback to redirect (break out of preview iframe if needed)
          const url = response.authorization_url;
          try {
            if (window.top && window.top !== window.self) {
              (window.top as Window).location.href = url;
            } else {
              window.location.href = url;
            }
          } catch {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
          return;
        }
        if (config?.public_key) {
          // Use Paystack inline popup
          const handler = window.PaystackPop.setup({
            key: config.public_key,
            email,
            amount: paystackService.formatAmount(amount),
            ref: serverRef,
            channels,
            currency: 'NGN',
            metadata: {
              orderId,
              customerName,
              customerPhone,
              ...metadata
            },
            onClose: () => {
              setLoading(false);
              onClose?.();
            },
            callback: (response: any) => {
              setLoading(false);
              if (response.status === 'success') {
                try { 
                  sessionStorage.setItem('paystack_last_reference', response.reference);
                  localStorage.setItem('paystack_last_reference', response.reference);
                } catch {}
                onSuccess(response.reference, response);
              } else {
                onError('Payment was not completed');
              }
            }
          });
          
          handler.openIframe();
        } else {
          // Fallback to redirect (break out of preview iframe if needed)
          const url = response.authorization_url;
          try {
            if (window.top && window.top !== window.self) {
              (window.top as Window).location.href = url;
            } else {
              window.location.href = url;
            }
          } catch {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        }
      } else {
        throw new Error('Failed to initialize payment');
      }
    } catch (error) {
      setLoading(false);
      console.error('Payment initialization error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Payment initialization failed';
      onError(errorMessage);
      toast.error(errorMessage);
    }
  }, [email, amount, orderId, customerName, customerPhone, metadata, channels, onSuccess, onError, onClose]);

  return (
    <Button
      onClick={initializePayment}
      disabled={disabled || loading}
      className={className}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children || `Pay ${paystackService.formatCurrency(amount)}`}
    </Button>
  );
};