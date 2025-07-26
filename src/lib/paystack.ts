import { supabase } from '@/integrations/supabase/client';

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
    const { data } = await supabase
      .from('payment_integrations')
      .select('*')
      .eq('provider', 'paystack')
      .eq('connection_status', 'connected')
      .maybeSingle();

    if (!data) return null;

    return {
      public_key: data.public_key,
      secret_key: data.secret_key,
      webhook_secret: data.webhook_secret,
      test_mode: data.test_mode || false,
    };
  }

  async initializeTransaction(transactionData: PaystackTransaction) {
    try {
      const response = await supabase.functions.invoke('paystack-initialize', {
        body: transactionData,
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
      const response = await supabase.functions.invoke('paystack-verify', {
        body: { reference },
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
      const response = await supabase.functions.invoke('paystack-charge', {
        body: {
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
    return `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  formatAmount(amount: number): number {
    // Convert to kobo (multiply by 100)
    return Math.round(amount * 100);
  }

  formatCurrency(amount: number, currency = 'NGN'): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
    }).format(amount);
  }
}

export const paystackService = new PaystackService();