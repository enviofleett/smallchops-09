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
   * Initialize a new payment transaction
   */
  static async initializePayment(request: InitializePaymentRequest): Promise<InitializePaymentResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('paystack-secure', {
        body: {
          action: 'initialize',
          email: request.email,
          amount: request.amount * 100, // Convert to kobo
          reference: request.reference,
          channels: request.channels || ['card', 'bank', 'ussd', 'mobile_money'],
          metadata: {
            order_id: request.orderDetails.id,
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

      if (!data?.status) {
        return {
          success: false,
          error: data?.error || 'Failed to initialize payment'
        };
      }

      return {
        success: true,
        data: {
          access_code: data.data.access_code,
          reference: data.data.reference,
          authorization_url: data.data.authorization_url
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
   * Verify a payment transaction
   */
  static async verifyPayment(reference: string): Promise<VerifyPaymentResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('paystack-verify', {
        body: { reference }
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // New function wrapper shape: { data: { success, paymentStatus, orderStatus, orderNumber, amount, reference, ... } }
      const fnRes: any = data;

      if (fnRes?.data && typeof fnRes.data.success === 'boolean') {
        return {
          success: true,
          data: {
            status: fnRes.data.paymentStatus || (fnRes.data.success ? 'paid' : 'failed'),
            // The function already normalizes to base currency (not kobo), so DO NOT divide again
            amount: typeof fnRes.data.amount === 'number' ? fnRes.data.amount : 0,
            // Optional passthrough fields if present
            customer: fnRes.data.customer ?? null,
            metadata: fnRes.data.metadata ?? null,
            paid_at: fnRes.data.paid_at ?? '',
            channel: fnRes.data.channel ?? ''
          }
        };
      }

      // Legacy/alternative shape: raw Paystack-like: { status: true, data: { amount, customer, metadata, paid_at, channel, ... } }
      if (!fnRes?.status) {
        return {
          success: false,
          error: fnRes?.error || 'Payment verification failed'
        };
      }

      return {
        success: true,
        data: {
          status: fnRes.data?.status || (fnRes.status ? 'paid' : 'failed'),
          amount: typeof fnRes.data?.amount === 'number' ? fnRes.data.amount / 100 : 0, // Legacy path expects kobo conversion
          customer: fnRes.data?.customer,
          metadata: fnRes.data?.metadata,
          paid_at: fnRes.data?.paid_at,
          channel: fnRes.data?.channel
        }
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
