import { supabase } from '@/integrations/supabase/client';

export interface PaymentVerificationResultV2 {
  success: boolean;
  message: string;
  order?: {
    order_id: string;
    order_number: string;
    status: string;
    amount: number;
    updated_at: string;
  };
  error?: string;
}

/**
 * Enhanced payment verification compatible with React Router
 * Uses the verify-payment edge function with improved response handling
 */
export async function verifyPaymentV2(reference: string): Promise<PaymentVerificationResultV2> {
  try {
    console.log('🔍 Starting enhanced payment verification for reference:', reference);
    
    // Call the verify-payment Edge Function directly
    const { data, error } = await supabase.functions.invoke('verify-payment', {
      body: { reference }
    });

    if (error) {
      console.error('❌ Edge function error:', error);
      throw new Error(error.message || 'Payment verification failed');
    }

    if (!data.success) {
      console.error('❌ Payment verification failed:', data.message);
      return {
        success: false,
        message: data.message || 'Payment verification failed',
        error: data.error
      };
    }

    console.log('✅ Payment verification successful:', data);
    
    // Transform the response to match our V2 interface
    const order = data.order;
    return {
      success: true,
      message: data.message || 'Payment verified successfully',
      order: order ? {
        order_id: order.order_id || order.id,
        order_number: order.order_number,
        status: order.status,
        amount: order.amount,
        updated_at: order.updated_at
      } : undefined
    };

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    return {
      success: false,
      message: 'An error occurred while verifying payment',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}