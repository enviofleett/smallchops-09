import { supabase } from '@/integrations/supabase/client';

export interface ProductionEmailHealth {
  smtp_configured: boolean;
  smtp_connection_healthy: boolean;
  queue_healthy: boolean;
  processing_healthy: boolean;
  last_check: string;
  recommendations: string[];
}

/**
 * Production-safe email health checker
 * Uses health check endpoints instead of sending test emails
 */
export class ProductionEmailHealthChecker {
  
  // Update production email health checker to use enhanced validation
  static async testSMTPConnection(): Promise<{
    success: boolean;
    message: string;
    configured: boolean;
    connection_healthy: boolean;
    user_type?: string;
    provider?: string;
    validation_details?: any;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('smtp-health-monitor', {
        body: { healthcheck: true }
      });

      if (error) {
        return {
          success: false,
          message: `SMTP health check failed: ${error.message}`,
          configured: false,
          connection_healthy: false
        };
      }

      const healthResult = data?.smtp_health || {};
      
      return {
        success: true,
        message: healthResult.connection_healthy 
          ? `SMTP connection healthy (${healthResult.user_type} via ${healthResult.provider || 'unknown provider'})` 
          : `SMTP configured but validation issues found`,
        configured: healthResult.configured || false,
        connection_healthy: healthResult.connection_healthy || false,
        user_type: healthResult.user_type,
        provider: healthResult.provider,
        validation_details: {
          source: healthResult.source,
          errors: healthResult.validation_errors,
          suggestions: healthResult.suggestions
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `SMTP health check failed: ${error.message}`,
        configured: false,
        connection_healthy: false
      };
    }
  }

  /**
   * Send production-safe test email using proper template
   */
  static async sendTestEmail(recipient: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: recipient,
          templateKey: 'smtp_connection_test',
          variables: {
            timestamp: new Date().toLocaleString()
          }
        }
      });

      if (error) {
        return {
          success: false,
          message: `Test email failed: ${error.message}`
        };
      }

      return {
        success: true,
        message: 'Test email sent successfully using production template'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Test email failed: ${error.message}`
      };
    }
  }

  /**
   * Get comprehensive email system health
   */
  static async getSystemHealth(): Promise<ProductionEmailHealth> {
    try {
      // Check SMTP health
      const smtpHealth = await this.testSMTPConnection();
      
      // Check queue health
      const { data: queueData } = await supabase
        .from('communication_events')
        .select('status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const queueStats = queueData?.reduce((acc: any, event: any) => {
        acc[event.status] = (acc[event.status] || 0) + 1;
        return acc;
      }, {}) || {};

      const processingBacklog = queueStats['processing'] || 0;
      const failedToday = queueStats['failed'] || 0;
      const totalToday = Object.values(queueStats).reduce((a: any, b: any) => Number(a) + Number(b), 0);

      const recommendations: string[] = [];
      
      if (!smtpHealth.configured) {
        recommendations.push('Configure SMTP settings in Function Secrets for production');
      }
      
      if (processingBacklog > 50) {
        recommendations.push('High processing backlog - check queue processor');
      }
      
      if (failedToday > 10) {
        recommendations.push('High failure rate - review SMTP configuration');
      }

      return {
        smtp_configured: smtpHealth.configured,
        smtp_connection_healthy: smtpHealth.connection_healthy,
        queue_healthy: processingBacklog < 100,
        processing_healthy: failedToday < (Number(totalToday) * 0.1),
        last_check: new Date().toISOString(),
        recommendations
      };
    } catch (error) {
      console.error('Failed to get email system health:', error);
      return {
        smtp_configured: false,
        smtp_connection_healthy: false,
        queue_healthy: false,
        processing_healthy: false,
        last_check: new Date().toISOString(),
        recommendations: ['Unable to check system health - check console for errors']
      };
    }
  }
}