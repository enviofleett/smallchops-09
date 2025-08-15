import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyPaymentV2, PaymentVerificationResultV2 } from '@/utils/paymentVerificationV2';

export function usePaymentVerificationV2() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const navigate = useNavigate();

  const verifyPaymentAndRedirect = useCallback(async (reference: string) => {
    setIsVerifying(true);
    setVerificationError(null);

    try {
      const result = await verifyPaymentV2(reference);

      if (result.success) {
        // Store success details for order confirmation page
        try {
          const orderDetails = {
            reference,
            orderId: result.order?.order_id,
            orderNumber: result.order?.order_number,
            amount: result.order?.amount,
            updatedAt: result.order?.updated_at,
            status: result.order?.status
          };
          
          sessionStorage.setItem('paymentSuccessV2', JSON.stringify(orderDetails));
          localStorage.setItem('lastPaymentSuccessV2', JSON.stringify(orderDetails));
        } catch (storageError) {
          console.warn('Failed to store payment success details:', storageError);
        }

        // Navigate to success state
        navigate('/payment/callback', {
          state: { 
            status: 'success', 
            result,
            reference 
          },
          replace: true
        });
      } else {
        setVerificationError(result.message);
        // Navigate to failure state
        navigate('/payment/callback', {
          state: { 
            status: 'failed', 
            result,
            reference 
          },
          replace: true
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setVerificationError(errorMessage);
      navigate('/payment/callback', {
        state: { 
          status: 'error', 
          result: { success: false, message: errorMessage, error: errorMessage },
          reference 
        },
        replace: true
      });
    } finally {
      setIsVerifying(false);
    }
  }, [navigate]);

  const retryVerification = useCallback(async (reference: string) => {
    await verifyPaymentAndRedirect(reference);
  }, [verifyPaymentAndRedirect]);

  return {
    verifyPaymentAndRedirect,
    retryVerification,
    isVerifying,
    verificationError
  };
}