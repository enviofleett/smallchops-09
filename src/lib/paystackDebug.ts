import { supabase } from '@/integrations/supabase/client';

export interface HealthCheckResult {
  environment: 'test' | 'live' | 'unknown';
  keyPresent: boolean;
  keyPrefix: string | null;
  timestamp: string;
}

export interface TransactionCheckResult {
  exists: boolean;
  status?: string;
  amount?: number;
  currency?: string;
  paid_at?: string;
  gateway_response?: string;
  latency_ms: number;
}

export interface DebugVerificationResult {
  success: boolean;
  data?: {
    status: string;
    amount: number;
    customer: any;
    metadata: any;
    paid_at: string;
    channel: string;
    reference: string;
  };
  debug?: {
    gateway_response?: string;
    fees?: any;
    authorization?: any;
    latency_ms: number;
    paystack_status_code: number;
  };
}

class PaystackDebugService {
  /**
   * Check Paystack environment and key configuration
   */
  async health(): Promise<HealthCheckResult> {
    try {
      const { data, error } = await supabase.functions.invoke('paystack-debug', {
        body: { action: 'check_key_health' }
      });

      if (error) throw error;
      
      // Map the response to the expected format
      const healthCheck = data?.health_check || {};
      return {
        environment: healthCheck.key_environment === 'TEST' ? 'test' : 
                    healthCheck.key_environment === 'LIVE' ? 'live' : 'unknown',
        keyPresent: healthCheck.key_configured || false,
        keyPrefix: healthCheck.key_prefix || null,
        timestamp: healthCheck.timestamp || new Date().toISOString()
      };
    } catch (error) {
      console.error('Health check error:', error);
      throw new Error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if transaction exists in Paystack (lightweight check)
   */
  async checkTransaction(reference: string): Promise<TransactionCheckResult> {
    try {
      const { data, error } = await supabase.functions.invoke('paystack-debug', {
        body: { action: 'check_reference', reference }
      });

      if (error) throw error;
      
      // Map the response to the expected format
      const debugInfo = data?.debug_info || {};
      return {
        exists: debugInfo.exists || false,
        status: debugInfo.transaction_status || undefined,
        amount: debugInfo.amount || undefined,
        currency: debugInfo.currency || undefined,
        paid_at: debugInfo.created_at || undefined,
        gateway_response: debugInfo.paystack_message || undefined,
        latency_ms: 0 // Not tracked in current implementation
      };
    } catch (error) {
      console.error('Transaction check error:', error);
      throw new Error(`Transaction check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Full verification with debug info (read-only)
   */
  async verifyTransaction(reference: string): Promise<DebugVerificationResult> {
    try {
      const { data, error } = await supabase.functions.invoke('paystack-debug', {
        body: { action: 'check_reference', reference }
      });

      if (error) throw error;
      
      // Map the response to the expected format
      const debugInfo = data?.debug_info || {};
      const rawResponse = data?.raw_response || {};
      
      return {
        success: data?.success || false,
        data: rawResponse?.data ? {
          status: rawResponse.data.status,
          amount: rawResponse.data.amount ? rawResponse.data.amount / 100 : 0,
          customer: rawResponse.data.customer,
          metadata: rawResponse.data.metadata,
          paid_at: rawResponse.data.created_at,
          channel: rawResponse.data.channel,
          reference: rawResponse.data.reference
        } : undefined,
        debug: {
          gateway_response: debugInfo.paystack_message,
          fees: rawResponse?.data?.fees,
          authorization: rawResponse?.data?.authorization,
          latency_ms: 0,
          paystack_status_code: debugInfo.http_status || 0
        }
      };
    } catch (error) {
      console.error('Debug verification error:', error);
      throw new Error(`Debug verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait and retry transaction check with exponential backoff
   */
  async waitAndCheckTransaction(reference: string, maxRetries: number = 3): Promise<TransactionCheckResult> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.checkTransaction(reference);
        if (result.exists) {
          return result;
        }
        
        // If not found, wait before retrying (but don't throw yet)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Cap at 5s
          console.log(`Transaction not found, waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`Check failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // If we get here, all retries failed
    throw lastError! || new Error('Transaction not found after all retries');
  }
}

export const paystackDebug = new PaystackDebugService();