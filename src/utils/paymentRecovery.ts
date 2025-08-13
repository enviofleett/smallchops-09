import { supabase } from '@/integrations/supabase/client';
import { PaymentVerificationResult } from './paymentVerification';

export interface RecoveryAttempt {
  reference: string;
  method: string;
  success: boolean;
  timestamp: string;
  error?: string;
}

export interface PaymentRecoveryManager {
  attemptRecovery: (reference: string) => Promise<PaymentVerificationResult>;
  getRecoveryHistory: (reference: string) => RecoveryAttempt[];
  clearRecoveryHistory: (reference: string) => void;
}

class PaymentRecoveryService implements PaymentRecoveryManager {
  private recoveryHistory: Map<string, RecoveryAttempt[]> = new Map();

  private addRecoveryAttempt(reference: string, method: string, success: boolean, error?: string) {
    const attempts = this.recoveryHistory.get(reference) || [];
    attempts.push({
      reference,
      method,
      success,
      timestamp: new Date().toISOString(),
      error
    });
    this.recoveryHistory.set(reference, attempts);
  }

  async attemptRecovery(reference: string): Promise<PaymentVerificationResult> {
    console.log('🔄 Starting payment recovery for:', reference);

    // Method 1: Direct database lookup
    try {
      const result = await this.tryDirectDatabaseLookup(reference);
      if (result.success) {
        this.addRecoveryAttempt(reference, 'database_direct', true);
        return result;
      }
    } catch (error) {
      this.addRecoveryAttempt(reference, 'database_direct', false, error.message);
    }

    // Method 2: Order-based recovery
    try {
      const result = await this.tryOrderBasedRecovery(reference);
      if (result.success) {
        this.addRecoveryAttempt(reference, 'order_based', true);
        return result;
      }
    } catch (error) {
      this.addRecoveryAttempt(reference, 'order_based', false, error.message);
    }

    // Method 3: Reference pattern matching
    try {
      const result = await this.tryReferencePatternMatching(reference);
      if (result.success) {
        this.addRecoveryAttempt(reference, 'pattern_matching', true);
        return result;
      }
    } catch (error) {
      this.addRecoveryAttempt(reference, 'pattern_matching', false, error.message);
    }

    // Method 4: Timestamp-based recovery (for txn_ references)
    if (reference.startsWith('txn_')) {
      try {
        const result = await this.tryTimestampBasedRecovery(reference);
        if (result.success) {
          this.addRecoveryAttempt(reference, 'timestamp_based', true);
          return result;
        }
      } catch (error) {
        this.addRecoveryAttempt(reference, 'timestamp_based', false, error.message);
      }
    }

    // All recovery methods failed
    this.addRecoveryAttempt(reference, 'all_methods_failed', false, 'No recovery method succeeded');
    return {
      success: false,
      message: 'Payment recovery failed - transaction not found in any system'
    };
  }

  private async tryDirectDatabaseLookup(reference: string): Promise<PaymentVerificationResult> {
    const { data: payment, error } = await supabase
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

    if (error || !payment) {
      throw new Error('Payment not found in database');
    }

    return {
      success: true,
      data: {
        status: payment.status === 'paid' ? 'success' : payment.status,
        amount: payment.amount,
        customer: { email: payment.orders?.customer_email },
        metadata: payment.metadata,
        paid_at: payment.paid_at,
        channel: (payment.metadata as any)?.channel || 'unknown',
        order_id: payment.order_id,
        order_number: payment.orders?.order_number
      }
    };
  }

  private async tryOrderBasedRecovery(reference: string): Promise<PaymentVerificationResult> {
    // Try to find order by payment reference
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        payment_transactions (
          provider_reference,
          amount,
          currency,
          status,
          paid_at,
          metadata
        )
      `)
      .or(`payment_reference.eq.${reference},paystack_reference.eq.${reference}`)
      .single();

    if (error || !order) {
      throw new Error('Order not found by reference');
    }

    const payment = order.payment_transactions?.[0];
    if (!payment) {
      throw new Error('No payment transaction found for order');
    }

    return {
      success: true,
      data: {
        status: order.payment_status === 'paid' ? 'success' : order.payment_status,
        amount: order.total_amount,
        customer: { email: order.customer_email },
        metadata: payment.metadata,
        paid_at: order.paid_at || payment.paid_at,
        channel: (payment.metadata as any)?.channel || 'unknown',
        order_id: order.id,
        order_number: order.order_number
      }
    };
  }

  private async tryReferencePatternMatching(reference: string): Promise<PaymentVerificationResult> {
    // Extract potential patterns from reference for fuzzy matching
    const patterns = this.extractReferencePatterns(reference);
    
    for (const pattern of patterns) {
      const { data: payments } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          orders (
            id,
            order_number,
            customer_email,
            total_amount,
            status
          )
        `)
        .ilike('provider_reference', `%${pattern}%`)
        .limit(5);

      if (payments && payments.length > 0) {
        // Find the best match
        const bestMatch = payments.find(p => 
          p.provider_reference.includes(reference) || 
          reference.includes(p.provider_reference)
        ) || payments[0];

        return {
          success: true,
          data: {
            status: bestMatch.status === 'paid' ? 'success' : bestMatch.status,
            amount: bestMatch.amount,
            customer: { email: bestMatch.orders?.customer_email },
            metadata: bestMatch.metadata,
            paid_at: bestMatch.paid_at,
          channel: (bestMatch.metadata as any)?.channel || 'unknown',
            order_id: bestMatch.order_id,
            order_number: bestMatch.orders?.order_number
          }
        };
      }
    }

    throw new Error('No payment found through pattern matching');
  }

  private async tryTimestampBasedRecovery(reference: string): Promise<PaymentVerificationResult> {
    // Extract timestamp from txn_ reference
    const match = reference.match(/^txn_(\d+)_/);
    if (!match) {
      throw new Error('Invalid txn reference format');
    }

    const timestamp = parseInt(match[1]);
    const date = new Date(timestamp);
    const timePadding = 5 * 60 * 1000; // 5 minutes

    const { data: payments } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        orders (
          id,
          order_number,
          customer_email,
          total_amount,
          status
        )
      `)
      .gte('created_at', new Date(timestamp - timePadding).toISOString())
      .lte('created_at', new Date(timestamp + timePadding).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (!payments || payments.length === 0) {
      throw new Error('No payments found in timestamp range');
    }

    // Look for best match by reference similarity
    const bestMatch = payments.find(p => 
      p.provider_reference.includes(reference.split('_')[2]) ||
      Math.abs(new Date(p.created_at).getTime() - timestamp) < 60000 // 1 minute
    ) || payments[0];

    return {
      success: true,
      data: {
        status: bestMatch.status === 'paid' ? 'success' : bestMatch.status,
        amount: bestMatch.amount,
        customer: { email: bestMatch.orders?.customer_email },
        metadata: bestMatch.metadata,
        paid_at: bestMatch.paid_at,
        channel: (bestMatch.metadata as any)?.channel || 'unknown',
        order_id: bestMatch.order_id,
        order_number: bestMatch.orders?.order_number
      }
    };
  }

  private extractReferencePatterns(reference: string): string[] {
    const patterns = [];
    
    // Split by common delimiters
    const parts = reference.split(/[_\-]/);
    patterns.push(...parts.filter(part => part.length > 3));
    
    // Extract UUID-like patterns
    const uuidPattern = /[a-f0-9-]{8,}/g;
    const uuids = reference.match(uuidPattern);
    if (uuids) patterns.push(...uuids);
    
    // Extract timestamp patterns
    const timestampPattern = /\d{10,}/g;
    const timestamps = reference.match(timestampPattern);
    if (timestamps) patterns.push(...timestamps);
    
    return [...new Set(patterns)]; // Remove duplicates
  }

  getRecoveryHistory(reference: string): RecoveryAttempt[] {
    return this.recoveryHistory.get(reference) || [];
  }

  clearRecoveryHistory(reference: string): void {
    this.recoveryHistory.delete(reference);
  }
}

export const paymentRecoveryManager = new PaymentRecoveryService();