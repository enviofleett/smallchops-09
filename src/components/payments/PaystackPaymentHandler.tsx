import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PaystackPaymentHandlerProps {
  amount: number;
  email: string;
  reference: string;
  orderNumber: string;
  paymentUrl: string;
  onSuccess: (reference: string) => void;
  onError: (error: string) => void;
  onClose?: () => void;
}

// Direct-redirect Paystack handler (no inline script, no external CSS)
export const PaystackPaymentHandler: React.FC<PaystackPaymentHandlerProps> = ({
  amount,
  paymentUrl,
}) => {
  const [loading, setLoading] = useState(false);

  const handleRedirect = useCallback(() => {
    if (!paymentUrl) {
      toast({ title: 'Payment Error', description: 'Missing payment URL', variant: 'destructive' });
      return;
    }
    setLoading(true);
    // Break out of iframe if needed to avoid CSP/CORS issues
    try {
      const url = paymentUrl as string;
      if (window.top && window.top !== window.self) {
        (window.top as Window).location.href = url;
      } else {
        window.location.href = url;
      }
    } catch {
      window.open(paymentUrl as string, '_blank', 'noopener,noreferrer');
    } finally {
      setTimeout(() => setLoading(false), 2000);
    }
  }, [paymentUrl]);

  return (
    <Button onClick={handleRedirect} className="w-full" size="lg" disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Redirecting...
        </>
      ) : (
        <>
          <CreditCard className="h-4 w-4 mr-2" />
          Pay ₦{amount.toLocaleString()}
        </>
      )}
    </Button>
  );
};
