import { supabase } from '@/integrations/supabase/client';

interface InitializePaymentRequest {
  email: string;
  amount: number;
  orderDetails: {
    id: string;
    items: Array<{
      name: string;
      price: number;
      quantity: number;
    }>;
  };
  customerInfo: {
    name: string;
    phone?: string;
    address?: string;
  };
  reference?: string;
  channels?: string[];
}

interface InitializePaymentResponse {
  success: boolean;
  data?: {
    access_code: string;
    reference: string;
    authorization_url: string;
  };
  error?: string;
}

interface VerifyPaymentResponse {
  success: boolean;
  data?: {
    status: string;
    amount: number;
    customer: any;
    metadata: any;
    paid_at: string;
    channel: string;
  };
  error?: string;
}

export class PaymentsAPI {
  /**
   * Initialize a new payment transaction (DEPRECATED - use usePayment hook)
   */
  static async initializePayment(request: InitializePaymentRequest): Promise<InitializePaymentResponse> {
    console.warn('DEPRECATED: PaymentsAPI.initializePayment is deprecated. Use usePayment hook with secure-payment-processor instead.')
    
    try {
      // Delegate to secure-payment-processor
      const { data, error } = await supabase.functions.invoke('secure-payment-processor', {
        body: {
          action: 'initialize',
          order_id: request.orderDetails.id,
          customer_email: request.email,
          metadata: {
            customer_name: request.customerInfo.name,
            customer_phone: request.customerInfo.phone,
            customer_address: request.customerInfo.address,
            items: request.orderDetails.items
          }
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: {
          access_code: data.access_code,
          reference: data.reference,
          authorization_url: data.authorization_url
        }
      };
    } catch (error) {
      console.error('Payment initialization error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment initialization failed'
      };
    }
  }

  /**
   * Verify a payment transaction (DEPRECATED - use usePayment hook)
   */
  static async verifyPayment(reference: string): Promise<VerifyPaymentResponse> {
    console.warn('DEPRECATED: PaymentsAPI.verifyPayment is deprecated. Use usePayment hook instead.')
    
    try {
      // Use unified secure-payment-processor for verification
      const { data, error } = await supabase.functions.invoke('secure-payment-processor', {
        body: { action: 'verify', reference }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Normalize response
      if (data?.success === true) {
        return {
          success: true,
          data: {
            status: 'success',
            amount: typeof data.amount === 'number' ? data.amount : 0,
            customer: data.customer ?? null,
            metadata: data.metadata ?? null,
            paid_at: data.paid_at ?? '',
            channel: data.channel ?? ''
          }
        };
      }

      return { success: false, error: data?.error || data?.message || 'Payment verification failed' };
    } catch (error) {
      console.error('Payment verification error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment verification failed'
      };
    }
  }

  /**
   * Get payment transaction details
   */
  static async getPaymentDetails(reference: string) {
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          orders (
            id,
            order_number,
            customer_name,
            customer_email,
            total_amount,
            status
          )
        `)
        .eq('provider_reference', reference)
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error fetching payment details:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch payment details'
      };
    }
  }

  /**
   * Get customer's payment history
   */
  static async getPaymentHistory(customerEmail: string, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          orders (
            id,
            order_number,
            total_amount,
            status
          )
        `)
        .eq('customer_email', customerEmail)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      console.error('Error fetching payment history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch payment history'
      };
    }
  }
}
