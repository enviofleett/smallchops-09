import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { paymentCompletionCoordinator } from '@/utils/paymentCompletion';

interface PaymentStatusMonitorProps {
  reference: string;
  onStatusUpdate: (status: 'pending' | 'success' | 'failed', data?: any) => void;
  intervalMs?: number;
  maxAttempts?: number;
}

export const PaymentStatusMonitor: React.FC<PaymentStatusMonitorProps> = ({
  reference,
  onStatusUpdate,
  intervalMs = 5000, // Increased from 3s to 5s
  maxAttempts = 8    // Further reduced to minimize API calls
}) => {
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [verificationLocked, setVerificationLocked] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Listen for global payment completion events
  useEffect(() => {
    const handlePaymentComplete = (event: any) => {
      const { reference: eventRef, success } = event.detail;
      if (eventRef === reference && success) {
        console.log('🌐 PaymentStatusMonitor received global completion event, stopping monitoring');
        setVerificationLocked(true);
        setStatus('success');
        setIsMonitoring(false);
      }
    };

    window.addEventListener('payment-verification-complete', handlePaymentComplete);
    return () => window.removeEventListener('payment-verification-complete', handlePaymentComplete);
  }, [reference]);

  useEffect(() => {
    if (!reference || !isMonitoring || attempts >= maxAttempts || verificationLocked) {
      return;
    }

    // Check if coordinator is already processing this reference
    if (paymentCompletionCoordinator.isProcessing(reference)) {
      console.log('🔒 Payment completion coordinator is already processing this reference, stopping monitor');
      setVerificationLocked(true);
      setStatus('success');
      setIsMonitoring(false);
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        console.log(`🔍 PaymentStatusMonitor checking: ${reference} (attempt ${attempts + 1})`);
        
        // Double-check if verification was already locked during this check
        if (verificationLocked || paymentCompletionCoordinator.isProcessing(reference)) {
          console.log('🔒 Verification already locked or being processed, skipping check');
          return;
        }
        
        // Use the enhanced paystack-verify function with better error handling
        const { data, error } = await supabase.functions.invoke('paystack-secure', {
          body: {
            action: 'verify',
            reference: reference
          }
        });

        if (error) {
          console.error('❌ PaymentStatusMonitor API error:', error);
          setLastError(error.message || 'API call failed');
          setAttempts(prev => prev + 1);
          return;
        }

        if (data?.status && data?.data) {
          const paymentStatus = data.data.status;
          
          if (paymentStatus === 'success') {
            console.log('✅ PaymentStatusMonitor: Payment verified as successful - IMMEDIATELY STOPPING');
            
            // 🔒 CRITICAL: Lock verification immediately to prevent race conditions
            setVerificationLocked(true);
            setStatus('success');
            setIsMonitoring(false);
            setLastError(null);
            
            // Signal other components to stop
            onStatusUpdate('success', data.data);
            
            // Emit global stop event to coordinate with other components
            window.dispatchEvent(new CustomEvent('payment-verification-complete', {
              detail: { reference, success: true, source: 'PaymentStatusMonitor' }
            }));
            
            return;
          } else {
            console.log(`🔄 PaymentStatusMonitor: Status is ${paymentStatus}, continuing...`);
          }
        }

        setAttempts(prev => prev + 1);
      } catch (error) {
        console.error('💥 PaymentStatusMonitor check error:', error);
        setLastError((error as Error).message || 'Unknown error');
        setAttempts(prev => prev + 1);
      }
    };

    const timeoutId = setTimeout(checkPaymentStatus, intervalMs);
    return () => clearTimeout(timeoutId);
  }, [reference, attempts, isMonitoring, intervalMs, maxAttempts, onStatusUpdate, verificationLocked]);

  // Stop monitoring if max attempts reached (but not if verification is already locked)
  useEffect(() => {
    if (attempts >= maxAttempts && isMonitoring && !verificationLocked) {
      console.log('⏰ PaymentStatusMonitor timeout reached');
      setIsMonitoring(false);
      setStatus('failed');
      onStatusUpdate('failed', { timeout: true, lastError });
    }
  }, [attempts, maxAttempts, isMonitoring, onStatusUpdate, verificationLocked, lastError]);

  const handleStopMonitoring = () => {
    console.log('🛑 Manually stopping PaymentStatusMonitor');
    setIsMonitoring(false);
  };

  const handleRetryVerification = () => {
    console.log('🔄 Manually retrying PaymentStatusMonitor verification');
    setVerificationLocked(false);
    setIsMonitoring(true);
    setAttempts(0);
    setLastError(null);
    setStatus('pending');
  };

  if (!isMonitoring && status === 'pending') {
    return (
      <Alert className="mb-4 border-orange-200 bg-orange-50">
        <AlertCircle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <div className="space-y-2">
            <p>Payment verification timeout. Please check your payment status manually or contact support.</p>
            {lastError && (
              <p className="text-sm text-orange-600">Last error: {lastError}</p>
            )}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRetryVerification}
              >
                Retry Verification
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => window.location.href = '/customer-profile'}
              >
                Check Orders
              </Button>
            </div>
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
          Payment verified successfully! Your order is being processed.
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'failed') {
    return (
      <Alert variant="destructive" className="mb-4">
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p>Payment verification failed. Please try again or contact support.</p>
            {lastError && (
              <p className="text-sm">Error: {lastError}</p>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetryVerification}
            >
              Retry Verification
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50">
      <Clock className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800">
        <div className="flex items-center justify-between">
          <div>
            <span>Verifying payment... (Attempt {attempts + 1} of {maxAttempts})</span>
            {lastError && (
              <p className="text-sm text-blue-600 mt-1">
                Last attempt: {lastError}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleStopMonitoring}>
            Stop
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};