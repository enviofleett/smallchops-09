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
      const supabaseUrl = 'https://oknnklksdiqaifhxaccs.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA';
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/paystack-debug?health=1`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return await response.json();
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
        body: { action: 'check', reference }
      });

      if (error) throw error;
      return data;
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
        body: { action: 'verify', reference }
      });

      if (error) throw error;
      return data;
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