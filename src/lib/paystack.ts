import { supabase } from '@/integrations/supabase/client';
import { PaymentValidator } from './payment-validators';

export interface PaystackConfig {
  public_key: string;
  secret_key: string;
  webhook_secret: string;
  test_mode: boolean;
}

export interface PaystackTransaction {
  email: string;
  amount: number;
  currency?: string;
  reference: string;
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
      const { data, error } = await supabase.rpc('get_active_paystack_config');

      if (error || !data) {
        console.error('Failed to get Paystack config:', error);
        return null;
      }

      // RPC returns a single row, not an array
      const configData = Array.isArray(data) ? data[0] : data;
      
      return {
        public_key: configData.public_key,
        secret_key: configData.secret_key,
        webhook_secret: configData.webhook_secret,
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

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data?.status) {
        throw new Error(response.data?.error || 'Failed to initialize payment');
      }

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
          ...chargeData,
          reference: chargeData.reference || this.generateReference()
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
    // Use secure reference generation
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