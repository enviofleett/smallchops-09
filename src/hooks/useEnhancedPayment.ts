import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePayment, PaymentResult, PaymentVerification } from './usePayment';

interface EnhancedPaymentState {
  isProcessing: boolean;
  paymentStatus: 'idle' | 'initiated' | 'pending' | 'verifying' | 'success' | 'failed';
  progress: number;
  message: string;
  pollCount: number;
  nextPollIn: number;
}

interface PollingOptions {
  enabled: boolean;
  maxRetries: number;
  onStatusUpdate?: (status: EnhancedPaymentState) => void;
}

export const useEnhancedPayment = () => {
  const { initiatePayment, verifyPayment, loading } = usePayment();
  
  const [state, setState] = useState<EnhancedPaymentState>({
    isProcessing: false,
    paymentStatus: 'idle',
    progress: 0,
    message: '',
    pollCount: 0,
    nextPollIn: 0
  });
  
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<any>(null);
  
  // Real-time payment updates via Supabase channels
  const setupRealtimeUpdates = useCallback((reference: string) => {
    const channel = supabase
      .channel('payment-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'payment_transactions',
        filter: `provider_reference=eq.${reference}`
      }, (payload) => {
        console.log('Real-time payment update:', payload);
        
        const newStatus = payload.new.status;
        if (newStatus === 'success' || newStatus === 'paid') {
          setState(prev => ({
            ...prev,
            paymentStatus: 'success',
            progress: 100,
            message: 'Payment confirmed!',
            isProcessing: false
          }));
          
          toast.success('Payment Successful!', {
            description: 'Your payment has been confirmed.'
          });
          
          // Clean up polling
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
        } else if (newStatus === 'failed') {
          setState(prev => ({
            ...prev,
            paymentStatus: 'failed',
            progress: 0,
            message: 'Payment failed',
            isProcessing: false
          }));
          
          toast.error('Payment Failed', {
            description: 'Your payment could not be processed.'
          });
        }
      })
      .subscribe();
    
    setRealtimeChannel(channel);
    return channel;
  }, [pollingInterval]);
  
  // Enhanced polling with exponential backoff
  const startPolling = useCallback(async (
    reference: string, 
    options: PollingOptions = { enabled: true, maxRetries: 50 }
  ) => {
    if (!options.enabled) return;
    
    setState(prev => ({
      ...prev,
      paymentStatus: 'pending',
      progress: 20,
      message: 'Monitoring payment status...'
    }));
    
    let pollCount = 0;
    const maxRetries = options.maxRetries;
    
    const poll = async () => {
      try {
        pollCount++;
        setState(prev => ({
          ...prev,
          pollCount,
          message: `Checking payment status... (${pollCount}/${maxRetries})`
        }));
        
        const { data, error } = await supabase.functions.invoke('enhanced-payment-polling', {
          body: { reference, maxRetries }
        });
        
        if (error) {
          console.error('Polling error:', error);
          return;
        }
        
        const { success, status, nextPollIn, retriesLeft } = data;
        
        setState(prev => ({
          ...prev,
          nextPollIn: nextPollIn || 0,
          progress: Math.min(90, (pollCount / maxRetries) * 100)
        }));
        
        if (status === 'success') {
          setState(prev => ({
            ...prev,
            paymentStatus: 'success',
            progress: 100,
            message: 'Payment confirmed!',
            isProcessing: false
          }));
          
          toast.success('Payment Successful!', {
            description: 'Your payment has been confirmed via polling.'
          });
          
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          return;
        } else if (status === 'failed') {
          setState(prev => ({
            ...prev,
            paymentStatus: 'failed',
            progress: 0,
            message: 'Payment failed',
            isProcessing: false
          }));
          
          toast.error('Payment Failed', {
            description: 'Your payment could not be processed.'
          });
          
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          return;
        } else if (status === 'timeout') {
          setState(prev => ({
            ...prev,
            paymentStatus: 'failed',
            progress: 0,
            message: 'Payment verification timeout',
            isProcessing: false
          }));
          
          toast.error('Payment Timeout', {
            description: 'Payment verification took too long. Please contact support.'
          });
          
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          return;
        }
        
        // Schedule next poll
        if (nextPollIn && retriesLeft > 0) {
          setTimeout(poll, nextPollIn * 1000);
          setState(prev => ({
            ...prev,
            message: `Payment pending. Next check in ${nextPollIn}s...`
          }));
        } else {
          // Max retries exceeded
          setState(prev => ({
            ...prev,
            paymentStatus: 'failed',
            message: 'Payment verification timeout',
            isProcessing: false
          }));
          
          toast.error('Payment Verification Timeout', {
            description: 'Unable to verify payment status. Please contact support.'
          });
        }
        
        if (options.onStatusUpdate) {
          options.onStatusUpdate(state);
        }
        
      } catch (error) {
        console.error('Polling error:', error);
        setState(prev => ({
          ...prev,
          message: 'Error checking payment status'
        }));
      }
    };
    
    // Start first poll after 10 seconds
    setTimeout(poll, 10000);
  }, [state, pollingInterval]);
  
  // Enhanced payment processing with real-time updates and polling
  const processEnhancedPayment = useCallback(async (
    orderId: string,
    amount: number,
    customerEmail?: string,
    options: {
      polling?: PollingOptions;
      realtime?: boolean;
      openInNewTab?: boolean;
    } = {}
  ): Promise<boolean> => {
    const { 
      polling = { enabled: true, maxRetries: 50 },
      realtime = true,
      openInNewTab = true 
    } = options;
    
    setState({
      isProcessing: true,
      paymentStatus: 'initiated',
      progress: 10,
      message: 'Initiating payment...',
      pollCount: 0,
      nextPollIn: 0
    });
    
    try {
      // Initiate payment
      const result: PaymentResult = await initiatePayment(orderId, amount, customerEmail);
      
      if (!result.success || !result.url) {
        setState(prev => ({
          ...prev,
          paymentStatus: 'failed',
          progress: 0,
          message: result.error || 'Payment initiation failed',
          isProcessing: false
        }));
        
        toast.error('Payment Failed', {
          description: result.error || 'Could not initiate payment'
        });
        return false;
      }
      
      setState(prev => ({
        ...prev,
        paymentStatus: 'pending',
        progress: 15,
        message: 'Payment window opened. Complete payment to continue...'
      }));
      
      // Open payment window
      if (openInNewTab) {
        window.open(result.url, '_blank');
      } else {
        window.location.href = result.url;
      }
      
      // Setup real-time updates if enabled
      if (realtime && result.sessionId) {
        setupRealtimeUpdates(result.sessionId);
      }
      
      // Start polling if enabled
      if (polling.enabled && result.sessionId) {
        await startPolling(result.sessionId, polling);
      }
      
      return true;
      
    } catch (error) {
      console.error('Enhanced payment error:', error);
      
      setState(prev => ({
        ...prev,
        paymentStatus: 'failed',
        progress: 0,
        message: 'Payment processing error',
        isProcessing: false
      }));
      
      toast.error('Payment Error', {
        description: 'An error occurred while processing your payment'
      });
      
      return false;
    }
  }, [initiatePayment, setupRealtimeUpdates, startPolling]);
  
  // Manual verification for callback pages
  const verifyEnhancedPayment = useCallback(async (reference: string): Promise<PaymentVerification | null> => {
    setState(prev => ({
      ...prev,
      paymentStatus: 'verifying',
      progress: 80,
      message: 'Verifying payment...'
    }));
    
    try {
      const verification = await verifyPayment(reference);
      
      if (verification.success) {
        setState(prev => ({
          ...prev,
          paymentStatus: 'success',
          progress: 100,
          message: 'Payment verified successfully!',
          isProcessing: false
        }));
        
        toast.success('Payment Verified!', {
          description: `Payment of ₦${verification.amountNaira?.toLocaleString()} confirmed`
        });
      } else {
        setState(prev => ({
          ...prev,
          paymentStatus: 'failed',
          progress: 0,
          message: 'Payment verification failed',
          isProcessing: false
        }));
      }
      
      return verification;
    } catch (error) {
      console.error('Payment verification error:', error);
      
      setState(prev => ({
        ...prev,
        paymentStatus: 'failed',
        progress: 0,
        message: 'Verification error',
        isProcessing: false
      }));
      
      return null;
    }
  }, [verifyPayment]);
  
  // Reset payment state
  const resetPaymentState = useCallback(() => {
    setState({
      isProcessing: false,
      paymentStatus: 'idle',
      progress: 0,
      message: '',
      pollCount: 0,
      nextPollIn: 0
    });
    
    // Clean up intervals and channels
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      setRealtimeChannel(null);
    }
  }, [pollingInterval, realtimeChannel]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [pollingInterval, realtimeChannel]);
  
  return {
    ...state,
    loading,
    processEnhancedPayment,
    verifyEnhancedPayment,
    resetPaymentState,
    setupRealtimeUpdates,
    startPolling
  };
};