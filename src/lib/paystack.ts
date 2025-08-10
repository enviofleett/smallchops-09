import { supabase } from '@/integrations/supabase/client';
import { PaymentValidator } from './payment-validators';

export interface PaystackConfig {
  public_key: string;
  secret_key?: string;
  webhook_secret?: string;
  test_mode: boolean;
}

export interface PaystackTransaction {
  email: string;
  amount: number;
  currency?: string;
  reference?: string;
  callback_url?: string;
  metadata?: Record<string, any>;
  channels?: string[];
}

export interface PaystackVerification {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at: string;
  channel: string;
  gateway_response: string;
  fees: number;
  authorization?: {
    authorization_code: string;
    card_type: string;
    last4: string;
    exp_month: string;
    exp_year: string;
    bank: string;
    account_name: string;
  };
}

class PaystackService {
  private baseURL = 'https://api.paystack.co';

  async getConfig(): Promise<PaystackConfig | null> {
    try {
      // Use the environment-aware configuration function
      const { data, error } = await (supabase.rpc as any)('get_public_paystack_config');

      if (error || !data) {
        console.error('Failed to get Paystack config:', error);
        return null;
      }

      // RPC returns a single row, not an array
      const configData = Array.isArray(data) ? data[0] : data;
      
      return {
        public_key: configData.public_key,
        test_mode: configData.test_mode,
      };
    } catch (error) {
      console.error('Error getting Paystack config:', error);
      return null;
    }
  }

  async initializeTransaction(transactionData: PaystackTransaction) {
    try {
      // Use the new secure endpoint
      const response = await supabase.functions.invoke('paystack-secure', {
        body: {
          action: 'initialize',
          ...transactionData,
        },
      });

      // 🔍 DEBUG: Log the complete response structure
      try {
        console.log('Complete Paystack response:', JSON.stringify(response.data, null, 2));
      } catch {
        console.log('Complete Paystack response (raw):', response.data);
      }

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data?.status) {
        throw new Error(response.data?.error || 'Failed to initialize payment');
      }

      // ✅ Extract and log payment URL and reference for debugging
      const paymentUrl = response.data?.data?.authorization_url;
      const paymentRef = response.data?.data?.reference;
      console.log('Extracted payment URL:', paymentUrl);
      console.log('Payment reference:', paymentRef);

      return response.data.data;
    } catch (error) {
      console.error('Failed to initialize Paystack transaction:', error);
      throw error;
    }
  }

  async verifyTransaction(reference: string) {
    try {
      // Use the new secure endpoint
      const response = await supabase.functions.invoke('paystack-secure', {
        body: {
          action: 'verify',
          reference,
        },
      });

      // 🔍 DEBUG: Log verification response
      try {
        console.log('Verification result (paystack-secure):', JSON.stringify(response.data, null, 2));
      } catch {
        console.log('Verification result (raw):', response.data);
      }

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data?.status) {
        throw new Error(response.data?.error || 'Failed to verify payment');
      }

      return response.data.data;
    } catch (error) {
      console.error('Failed to verify Paystack transaction:', error);
      throw error;
    }
  }

  async chargeAuthorization(chargeData: {
    authorization_code: string;
    email: string;
    amount: number;
    reference?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      // Use the new secure endpoint
      const response = await supabase.functions.invoke('paystack-secure', {
        body: {
          action: 'charge',
          ...chargeData
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data?.status) {
        throw new Error(response.data?.error || 'Failed to charge payment');
      }

      return response.data.data;
    } catch (error) {
      console.error('Failed to charge authorization:', error);
      throw error;
    }
  }

  async getBanks() {
    try {
      const response = await supabase.functions.invoke('paystack-banks');

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data?.status) {
        throw new Error(response.data?.error || 'Failed to fetch banks');
      }

      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch banks:', error);
      throw error;
    }
  }

  generateReference(): string {
    // DEPRECATED: Do not use client-side references for payments
    console.warn('generateReference() is deprecated. Use server-generated references from paystack-secure.');
    const timestamp = Date.now();
    const randomBytes = crypto.getRandomValues(new Uint8Array(8));
    const randomHex = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `PAY_${timestamp}_${randomHex}`;
  }

  formatAmount(amount: number): number {
    // Use secure amount validation and conversion
    const validation = PaymentValidator.validateAmount(amount, 'NGN');
    if (!validation.isValid) {
      throw new Error(`Invalid amount: ${validation.errors.join(', ')}`);
    }
    return validation.subunitAmount;
  }

  formatCurrency(amount: number, currency = 'NGN'): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
    }).format(amount);
  }
}

export const paystackService = new PaystackService();