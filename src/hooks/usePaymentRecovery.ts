import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { verifyPaymentV2 } from '@/utils/paymentVerificationV2';

interface RecoveryAttempt {
  reference: string;
  timestamp: string;
  success: boolean;
  error?: string;
}

export const usePaymentRecovery = () => {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryHistory, setRecoveryHistory] = useState<RecoveryAttempt[]>([]);

  const attemptPaymentRecovery = useCallback(async (reference: string) => {
    setIsRecovering(true);
    
    const attemptStart = new Date().toISOString();
    
    try {
      console.log('🔄 Starting payment recovery for reference:', reference);
      
      // First, check if the order exists in our database
      const { data: orderCheck, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          payment_status,
          status,
          total_amount,
          payment_reference,
          paystack_reference,
          created_at
        `)
        .or(`payment_reference.eq.${reference},paystack_reference.eq.${reference}`)
        .maybeSingle();

      if (orderError) {
        throw new Error(`Order lookup failed: ${orderError.message}`);
      }

      if (!orderCheck) {
        throw new Error('No order found for this payment reference');
      }

      console.log('📋 Found order for recovery:', orderCheck);

      // If already paid, no recovery needed
      if (orderCheck.payment_status === 'paid') {
        const successAttempt: RecoveryAttempt = {
          reference,
          timestamp: attemptStart,
          success: true
        };
        setRecoveryHistory(prev => [successAttempt, ...prev]);
        
        toast.success('Payment already confirmed - no recovery needed');
        return {
          success: true,
          message: 'Payment already confirmed',
          order: orderCheck
        };
      }

      // Attempt payment verification
      console.log('🔍 Attempting payment verification...');
      const verificationResult = await verifyPaymentV2(reference);

      if (verificationResult.success) {
        const successAttempt: RecoveryAttempt = {
          reference,
          timestamp: attemptStart,
          success: true
        };
        setRecoveryHistory(prev => [successAttempt, ...prev]);
        
        toast.success('Payment recovered successfully!');
        
        return {
          success: true,
          message: 'Payment recovered successfully',
          order: verificationResult.order
        };
      } else {
        throw new Error(verificationResult.message || 'Payment verification failed');
      }

    } catch (error) {
      console.error('❌ Payment recovery failed:', error);
      
      const failedAttempt: RecoveryAttempt = {
        reference,
        timestamp: attemptStart,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      setRecoveryHistory(prev => [failedAttempt, ...prev]);
      
      toast.error(`Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Recovery failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
    } finally {
      setIsRecovering(false);
    }
  }, []);

  const clearRecoveryHistory = useCallback(() => {
    setRecoveryHistory([]);
  }, []);

  return {
    attemptPaymentRecovery,
    isRecovering,
    recoveryHistory,
    clearRecoveryHistory
  };
};

export default usePaymentRecovery;