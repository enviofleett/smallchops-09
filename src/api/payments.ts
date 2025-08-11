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
          reference: request.reference, // Use provided txn_ reference
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
      // Prefer secure verifier that performs atomic updates
      const { data: primaryData, error: primaryError } = await supabase.functions.invoke('paystack-secure', {
        body: { action: 'verify', reference }
      });

      const normalize = (res: any): VerifyPaymentResponse => {
        // paystack-verify returns { success, amount (NGN), ... }
        if (res?.success === true) {
          return {
            success: true,
            data: {
              status: 'success',
              amount: typeof res.amount === 'number' ? res.amount : 0,
              customer: res.customer ?? null,
              metadata: res.metadata ?? null,
              paid_at: res.paid_at ?? '',
              channel: res.channel ?? ''
            }
          };
        }
        // paystack-secure returns { status: true, data: {...} }
        if (res?.status === true) {
          return {
            success: true,
            data: {
              status: res.data?.status || 'success',
              amount: typeof res.data?.amount === 'number' ? res.data.amount / 100 : 0,
              customer: res.data?.customer,
              metadata: res.data?.metadata,
              paid_at: res.data?.paid_at,
              channel: res.data?.channel
            }
          };
        }
        return { success: false, error: res?.error || res?.message || 'Payment verification failed' };
      };

      if (!primaryError && primaryData) {
        const normalized = normalize(primaryData);
        if (normalized.success) return normalized;
      }

      // Fallback to secure verifier
      const { data, error } = await supabase.functions.invoke('paystack-secure', {
        body: { action: 'verify', reference }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return normalize(data);
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
