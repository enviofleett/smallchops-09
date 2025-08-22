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
    order_id?: string;
    order_number?: string;
    amount_verified?: boolean;
  };
  error?: string;
}

export class PaymentsAPI {
  /**
   * Initialize a new payment transaction (Production-Ready with Integer Math)
   */
  static async initializePayment(request: InitializePaymentRequest): Promise<InitializePaymentResponse> {
    try {
      // Convert amount to kobo (integer) to avoid floating point issues
      const amountKobo = Math.round(request.amount * 100);
      
      const { data, error } = await supabase.functions.invoke('secure-payment-processor', {
        body: {
          email: request.email,
          amount_kobo: amountKobo, // Always use integer amounts
          reference: request.reference, // Use provided txn_ reference
          channels: request.channels || ['card', 'bank', 'ussd', 'mobile_money'],
          order_details: {
            id: request.orderDetails.id,
            items: request.orderDetails.items
          },
          customer_info: {
            name: request.customerInfo.name,
            phone: request.customerInfo.phone,
            address: request.customerInfo.address
          },
          // Generate idempotency key for this request
          idempotency_key: `init_${request.reference}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // Handle both success and status response formats
      const isSuccess = data?.status === true || data?.success === true;
      if (!isSuccess) {
        return {
          success: false,
          error: data?.error || data?.message || 'Failed to initialize payment'
        };
      }

      const responseData = data.data || data;
      return {
        success: true,
        data: {
          access_code: responseData.access_code,
          reference: responseData.reference,
          authorization_url: responseData.authorization_url
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
   * Verify a payment transaction (Production-Ready with Idempotency)
   */
  static async verifyPayment(reference: string, idempotencyKey?: string): Promise<VerifyPaymentResponse> {
    try {
      // Use secure atomic verifier
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { 
          reference,
          idempotency_key: idempotencyKey || `verify_${reference}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (error) {
        return { 
          success: false, 
          error: error.message || 'Payment verification failed' 
        };
      }

      // Handle successful verification
      if (data?.success === true) {
        return {
          success: true,
          data: {
            status: 'success',
            amount: data.amount || 0, // Amount already converted from kobo to naira
            customer: data.customer || null,
            metadata: data.metadata || null,
            paid_at: data.paid_at || '',
            channel: data.channel || '',
            order_id: data.order_id,
            order_number: data.order_number,
            amount_verified: data.amount_verified || false
          }
        };
      }

      return { 
        success: false, 
        error: data?.error || 'Payment verification failed' 
      };
      
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
