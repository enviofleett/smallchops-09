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
 * Uses the unified verify-payment-unified edge function
 */
export async function verifyPaymentV2(reference: string): Promise<PaymentVerificationResultV2> {
  try {
    console.log('🔍 Starting enhanced payment verification for reference:', reference);
    
    // Use the unified edge function with proper parameters
    const url = new URL(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/verify-payment-unified`);
    
    // Extract order_id from reference or use a placeholder
    // In production, we should have order_id from context
    const orderId = 'unknown'; // This should be passed as a parameter
    
    url.searchParams.set('order_id', orderId);
    url.searchParams.set('reference', reference);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('❌ Edge function HTTP error:', response.status, response.statusText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      console.error('❌ Payment verification failed:', data.error || data.message);
      return {
        success: false,
        message: data.error || data.message || 'Payment verification failed',
        error: data.error
      };
    }

    console.log('✅ Payment verification successful:', data);
    
    // Transform the response to match our V2 interface
    const orderData = data.data;
    return {
      success: true,
      message: 'Payment verified successfully',
      order: orderData ? {
        order_id: orderData.order_id,
        order_number: orderData.order_number,
        status: orderData.status,
        amount: orderData.amount,
        updated_at: orderData.updated_at
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