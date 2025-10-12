import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { verifySecurePayment } from '@/utils/paystackOnly';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface VerificationStep {
  step: string;
  status: 'pending' | 'success' | 'error';
  message: string;
}

export const usePaymentConfirmation = () => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [verificationSteps, setVerificationSteps] = useState<VerificationStep[]>([]);
  const queryClient = useQueryClient();

  const updateStep = (step: string, status: VerificationStep['status'], message: string) => {
    setVerificationSteps(prev => {
      const existing = prev.find(s => s.step === step);
      if (existing) {
        return prev.map(s => s.step === step ? { step, status, message } : s);
      }
      return [...prev, { step, status, message }];
    });
  };

  const confirmPayment = async (
    orderId: string,
    reference: string,
    orderNumber: string
  ) => {
    if (!reference) {
      toast.error('No payment reference found for this order');
      return { success: false };
    }

    setIsConfirming(true);
    setVerificationSteps([]);
    
    // Show live progress toast
    const progressToast = toast.loading(`Step 1/4: Initiating payment verification for order #${orderNumber}...`, {
      duration: Infinity,
    });
    
    try {
      // Step 1: Verify with Paystack
      updateStep('paystack', 'pending', 'Contacting Paystack API...');
      toast.loading(`Step 1/4: Verifying with Paystack...`, { id: progressToast });
      
      const result = await verifySecurePayment(reference);
      
      if (!result.success || (result.status !== 'success' && result.status !== 'completed')) {
        updateStep('paystack', 'error', `Paystack verification failed: ${result.status || 'Unknown error'}`);
        toast.dismiss(progressToast);
        toast.error('❌ Payment verification failed', {
          duration: 6000,
          description: `Paystack returned status: ${result.status || 'Unknown'}. Payment was not successful.`
        });
        return { success: false, error: 'Paystack verification failed' };
      }
      
      updateStep('paystack', 'success', 'Paystack verification successful');
      toast.loading(`Step 2/4: Payment verified with Paystack ✓`, { id: progressToast });
      
      // Step 2: Update order status in database
      updateStep('database', 'pending', 'Updating order status...');
      toast.loading(`Step 2/4: Updating order in database...`, { id: progressToast });
      
      const { data: updateData, error: updateError } = await supabase
        .rpc('admin_safe_update_order_status', {
          p_order_id: orderId,
          p_new_status: 'confirmed',
          p_admin_id: (await supabase.auth.getUser()).data.user?.id
        });

      if (updateError) {
        updateStep('database', 'error', `Database update failed: ${updateError.message}`);
        toast.dismiss(progressToast);
        toast.error('❌ Failed to update order status', {
          duration: 6000,
          description: updateError.message
        });
        return { success: false, error: updateError.message };
      }

      updateStep('database', 'success', 'Order status updated successfully');
      toast.loading(`Step 3/4: Order status updated ✓`, { id: progressToast });
      
      // Step 3: Update payment status
      updateStep('payment_status', 'pending', 'Updating payment status...');
      toast.loading(`Step 3/4: Finalizing payment status...`, { id: progressToast });
      
      const { error: paymentError } = await supabase
        .from('orders')
        .update({ 
          payment_status: 'completed',
          payment_verified_at: new Date().toISOString(),
          paid_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (paymentError) {
        updateStep('payment_status', 'error', `Payment status update failed: ${paymentError.message}`);
        toast.dismiss(progressToast);
        toast.error('⚠️ Order confirmed but payment status update failed', {
          duration: 6000,
          description: paymentError.message
        });
        return { success: false, error: paymentError.message };
      }

      updateStep('payment_status', 'success', 'Payment status marked as completed');
      toast.loading(`Step 4/4: Refreshing data...`, { id: progressToast });
      
      // Step 4: Refresh all order queries
      updateStep('refresh', 'pending', 'Refreshing order data...');
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders-list'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-orders-polling'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.refetchQueries({ queryKey: ['orders-list'], type: 'active' })
      ]);
      
      updateStep('refresh', 'success', 'All data refreshed');
      
      // Final success message
      toast.dismiss(progressToast);
      toast.success(`✅ Payment confirmed successfully!`, {
        duration: 6000,
        description: `Order #${orderNumber} has been verified and confirmed. Payment status: ${result.status}`
      });
      
      return { 
        success: true, 
        paystackData: result,
        steps: verificationSteps 
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      updateStep('error', 'error', errorMessage);
      
      console.error('Payment confirmation error:', error);
      toast.dismiss(progressToast);
      toast.error('❌ Payment confirmation failed', {
        duration: 6000,
        description: errorMessage + ' - Please check the logs and try again.'
      });
      
      // Refresh to show current state
      await queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      
      return { success: false, error: errorMessage };
    } finally {
      setIsConfirming(false);
    }
  };

  return {
    confirmPayment,
    isConfirming,
    verificationSteps
  };
};
