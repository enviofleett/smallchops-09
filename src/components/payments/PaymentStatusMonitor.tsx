import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentStatusMonitorProps {
  reference: string;
  onStatusUpdate: (status: 'pending' | 'success' | 'failed', data?: any) => void;
  intervalMs?: number;
  maxAttempts?: number;
}

export const PaymentStatusMonitor: React.FC<PaymentStatusMonitorProps> = ({
  reference,
  onStatusUpdate,
  intervalMs = 3000,
  maxAttempts = 20
}) => {
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [isMonitoring, setIsMonitoring] = useState(true);

  useEffect(() => {
    if (!reference || !isMonitoring || attempts >= maxAttempts) {
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        console.log(`🔍 Checking payment status for reference: ${reference} (attempt ${attempts + 1})`);
        
        // Use the enhanced paystack-verify function with better error handling
        const { data, error } = await supabase.functions.invoke('paystack-verify', {
          body: {
            reference: reference
          }
        });

        if (error) {
          console.error('❌ Error checking payment status:', error);
          setAttempts(prev => prev + 1);
          return;
        }

        if (data?.status && data?.data) {
          const paymentStatus = data.data.status;
          
          if (paymentStatus === 'success') {
            console.log('✅ Payment verified as successful');
            setStatus('success');
            setIsMonitoring(false);
            onStatusUpdate('success', data.data);
            return;
          } else if (paymentStatus === 'failed' || paymentStatus === 'abandoned') {
            console.log('❌ Payment verified as failed');
            setStatus('failed');
            setIsMonitoring(false);
            onStatusUpdate('failed', data.data);
            return;
          }
        }

        setAttempts(prev => prev + 1);
      } catch (error) {
        console.error('💥 Payment status check error:', error);
        setAttempts(prev => prev + 1);
      }
    };

    const timeoutId = setTimeout(checkPaymentStatus, intervalMs);
    return () => clearTimeout(timeoutId);
  }, [reference, attempts, isMonitoring, intervalMs, maxAttempts, onStatusUpdate]);

  // Stop monitoring if max attempts reached
  useEffect(() => {
    if (attempts >= maxAttempts && isMonitoring) {
      console.log('⏰ Payment monitoring timeout reached');
      setIsMonitoring(false);
      onStatusUpdate('failed', { timeout: true });
    }
  }, [attempts, maxAttempts, isMonitoring, onStatusUpdate]);

  const handleStopMonitoring = () => {
    setIsMonitoring(false);
  };

  if (!isMonitoring && status === 'pending') {
    return (
      <Alert className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Payment verification timeout. Please check your payment status manually or contact support.
          <div className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setIsMonitoring(true)}>
              Retry Verification
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'success') {
    return (
      <Alert className="mb-4 border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Payment verified successfully!
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'failed') {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Payment verification failed. Please try again or contact support.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50">
      <Clock className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800">
        <div className="flex items-center justify-between">
          <span>Verifying payment... (Attempt {attempts + 1} of {maxAttempts})</span>
          <Button variant="outline" size="sm" onClick={handleStopMonitoring}>
            Stop
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};