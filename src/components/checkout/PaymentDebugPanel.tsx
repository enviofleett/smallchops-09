import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export const PaymentDebugPanel: React.FC = () => {
  const [paystackStatus, setPaystackStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [testPayment, setTestPayment] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  useEffect(() => {
    checkPaystackStatus();
  }, []);

  const checkPaystackStatus = () => {
    setPaystackStatus('loading');
    
    if (window.PaystackPop) {
      setPaystackStatus('loaded');
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => {
      if (window.PaystackPop) {
        setPaystackStatus('loaded');
      } else {
        setPaystackStatus('error');
      }
    };
    script.onerror = () => setPaystackStatus('error');
    document.head.appendChild(script);
  };

  const testPaystackIntegration = () => {
    setTestPayment('testing');
    
    try {
      const handler = window.PaystackPop.setup({
        key: 'pk_live_0b6a7a38a3afaaa5dd1ab30c7fbee8a3d9a4e2e7',
        email: 'test@example.com',
        amount: 10000, // ₦100 in kobo
        currency: 'NGN',
        ref: `test_${Date.now()}`,
        callback: (response: any) => {
          console.log('Test payment response:', response);
          setTestPayment('success');
        },
        onClose: () => {
          setTestPayment('idle');
        }
      });
      
      handler.openIframe();
    } catch (error) {
      console.error('Test payment error:', error);
      setTestPayment('error');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'loading':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'loaded':
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg">Payment Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span>Paystack Script:</span>
          <div className="flex items-center gap-2">
            {getStatusIcon(paystackStatus)}
            <Badge variant={paystackStatus === 'loaded' ? 'default' : 'destructive'}>
              {paystackStatus}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span>Live Public Key:</span>
          <Badge variant="outline">
            pk_live_...e7 ✓
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span>Test Payment:</span>
          <div className="flex items-center gap-2">
            {getStatusIcon(testPayment)}
            <Badge variant={testPayment === 'success' ? 'default' : 'secondary'}>
              {testPayment}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <Button 
            onClick={checkPaystackStatus} 
            variant="outline" 
            size="sm" 
            className="w-full"
            disabled={paystackStatus === 'loading'}
          >
            Reload Paystack Script
          </Button>
          
          <Button 
            onClick={testPaystackIntegration}
            variant="outline"
            size="sm"
            className="w-full"
            disabled={paystackStatus !== 'loaded' || testPayment === 'testing'}
          >
            Test ₦100 Payment
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>• Script loads from: js.paystack.co</p>
          <p>• Environment: Production</p>
          <p>• Callback URL: /payment/callback</p>
        </div>
      </CardContent>
    </Card>
  );
};