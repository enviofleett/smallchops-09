import { supabase } from '@/integrations/supabase/client';

export interface PaymentMetric {
  reference: string;
  success: boolean;
  error?: string;
  timestamp: number;
  environment: string;
  attempt: number;
  mapping_strategy?: string;
}

export class PaymentMetricsLogger {
  private static metrics: PaymentMetric[] = [];
  private static maxMetrics = 100;

  static logVerificationAttempt(
    reference: string,
    success: boolean,
    attempt: number = 1,
    error?: string,
    mappingStrategy?: string
  ) {
    const metric: PaymentMetric = {
      reference,
      success,
      error,
      timestamp: Date.now(),
      environment: import.meta.env.MODE || 'development',
      attempt,
      mapping_strategy: mappingStrategy
    };

    // Store locally for immediate access
    this.metrics.unshift(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(0, this.maxMetrics);
    }

    // Log to console with emoji for easy filtering
    const emoji = success ? '✅' : '❌';
    console.log(`${emoji} PAYMENT_VERIFICATION_METRIC:`, JSON.stringify(metric));

    // Persist to database (fire-and-forget)
    this.persistMetric(metric).catch(err => 
      console.warn('Failed to persist payment metric:', err)
    );

    // Alert on failures
    if (!success) {
      this.checkFailureRate();
    }
  }

  private static async persistMetric(metric: PaymentMetric) {
    try {
      await supabase.from('audit_logs').insert({
        action: 'payment_verification_metric',
        category: 'Payment',
        message: `Payment verification ${metric.success ? 'success' : 'failure'}: ${metric.reference}`,
        new_values: {
          reference: metric.reference,
          success: metric.success,
          error: metric.error || null,
          timestamp: metric.timestamp,
          environment: metric.environment,
          attempt: metric.attempt,
          mapping_strategy: metric.mapping_strategy || null
        }
      });
    } catch (error) {
      // Fail silently to avoid breaking payment flow
      console.debug('Metric persistence failed:', error);
    }
  }

  private static checkFailureRate() {
    const recentMetrics = this.metrics.filter(
      m => Date.now() - m.timestamp < 5 * 60 * 1000 // Last 5 minutes
    );

    if (recentMetrics.length >= 10) {
      const failureRate = recentMetrics.filter(m => !m.success).length / recentMetrics.length;
      
      if (failureRate > 0.5) {
        console.error('🚨 HIGH PAYMENT FAILURE RATE:', {
          failureRate: `${(failureRate * 100).toFixed(1)}%`,
          recentFailures: recentMetrics.filter(m => !m.success).length,
          totalRecent: recentMetrics.length
        });
        
        // In production, this would trigger an alert to monitoring system
        this.triggerAlert('HIGH_PAYMENT_FAILURE_RATE', { failureRate, recentFailures: recentMetrics.length });
      }
    }
  }

  private static triggerAlert(type: string, data: any) {
    // In production, integrate with your alerting system (Sentry, DataDog, etc.)
    console.error(`🚨 PAYMENT_ALERT [${type}]:`, data);
    
    // Example: Send to monitoring webhook
    // fetch('/api/alerts', {
    //   method: 'POST',
    //   body: JSON.stringify({ type, data, timestamp: Date.now() })
    // }).catch(() => {});
  }

  static getRecentMetrics(minutes: number = 30): PaymentMetric[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  static getSuccessRate(minutes: number = 30): number {
    const recent = this.getRecentMetrics(minutes);
    if (recent.length === 0) return 1;
    
    const successCount = recent.filter(m => m.success).length;
    return successCount / recent.length;
  }

  static getMostCommonErrors(minutes: number = 30): Array<{ error: string; count: number }> {
    const recent = this.getRecentMetrics(minutes);
    const errors = recent.filter(m => !m.success && m.error);
    
    const errorCounts = errors.reduce((acc, metric) => {
      const error = metric.error!;
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(errorCounts)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
}

// Export convenience function
export const logPaymentVerification = PaymentMetricsLogger.logVerificationAttempt.bind(PaymentMetricsLogger);