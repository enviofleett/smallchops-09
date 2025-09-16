import { supabase } from '@/integrations/supabase/client';

export interface CheckoutErrorAudit {
  timestamp: string;
  errorType: 'NETWORK' | 'EDGE_FUNCTION' | 'VALIDATION' | 'PAYMENT' | 'UNKNOWN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  recommendation: string;
  technicalDetails: any;
  canRetry: boolean;
}

export interface CheckoutAuditReport {
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  errors: CheckoutErrorAudit[];
  summary: {
    totalErrors: number;
    criticalErrors: number;
    networkIssues: number;
    edgeFunctionIssues: number;
  };
  recommendations: string[];
}

export class CheckoutErrorAuditor {
  static async auditCheckoutError(error: any, context?: any): Promise<CheckoutErrorAudit> {
    const audit: CheckoutErrorAudit = {
      timestamp: new Date().toISOString(),
      errorType: 'UNKNOWN',
      severity: 'MEDIUM',
      description: 'Unknown checkout error',
      recommendation: 'Please try again',
      technicalDetails: error,
      canRetry: true
    };

    // Analyze error patterns
    if (error?.message?.includes('Failed to send a request to the Edge Function')) {
      audit.errorType = 'EDGE_FUNCTION';
      audit.severity = 'HIGH';
      audit.description = 'Edge Function connectivity issue';
      audit.recommendation = 'Check edge function deployment and network connectivity';
      
      if (error?.context?.message?.includes('Failed to fetch')) {
        audit.severity = 'CRITICAL';
        audit.description = 'Complete network failure when calling edge function';
        audit.recommendation = 'Verify edge function is deployed and accessible. Check CORS settings.';
      }
    }

    if (error?.message?.includes('Failed to fetch')) {
      audit.errorType = 'NETWORK';
      audit.severity = 'HIGH';
      audit.description = 'Network connectivity issue';
      audit.recommendation = 'Check internet connection and server availability';
    }

    if (error?.message?.includes('ORDER_CREATION_FAILED')) {
      audit.errorType = 'VALIDATION';
      audit.severity = 'HIGH';
      audit.description = 'Order creation validation failed';
      audit.recommendation = 'Verify order data format and required fields';
    }

    return audit;
  }

  static async runComprehensiveAudit(): Promise<CheckoutAuditReport> {
    const errors: CheckoutErrorAudit[] = [];
    const recommendations: string[] = [];

    // Test edge function connectivity
    try {
      const { data, error } = await supabase.functions.invoke('process-checkout', {
        body: { test: true }
      });
      
      if (error) {
        errors.push({
          timestamp: new Date().toISOString(),
          errorType: 'EDGE_FUNCTION',
          severity: 'CRITICAL',
          description: 'Edge function not responding',
          recommendation: 'Deploy or restart the process-checkout edge function',
          technicalDetails: error,
          canRetry: false
        });
      }
    } catch (error) {
      errors.push({
        timestamp: new Date().toISOString(),
        errorType: 'EDGE_FUNCTION',
        severity: 'CRITICAL',
        description: 'Cannot connect to edge function',
        recommendation: 'Check edge function deployment and URL configuration',
        technicalDetails: error,
        canRetry: false
      });
    }

    // Check business settings
    try {
      const { data: businessData, error: businessError } = await supabase
        .from('business_settings')
        .select('*')
        .single();

      if (businessError || !businessData) {
        errors.push({
          timestamp: new Date().toISOString(),
          errorType: 'VALIDATION',
          severity: 'HIGH',
          description: 'Business settings not configured',
          recommendation: 'Configure business settings in admin panel',
          technicalDetails: businessError,
          canRetry: false
        });
      }
    } catch (error) {
      errors.push({
        timestamp: new Date().toISOString(),
        errorType: 'VALIDATION',
        severity: 'MEDIUM',
        description: 'Cannot verify business settings',
        recommendation: 'Check database connectivity and business_settings table',
        technicalDetails: error,
        canRetry: true
      });
    }

    // Generate summary
    const summary = {
      totalErrors: errors.length,
      criticalErrors: errors.filter(e => e.severity === 'CRITICAL').length,
      networkIssues: errors.filter(e => e.errorType === 'NETWORK').length,
      edgeFunctionIssues: errors.filter(e => e.errorType === 'EDGE_FUNCTION').length
    };

    // Generate recommendations
    if (summary.edgeFunctionIssues > 0) {
      recommendations.push('Deploy and verify edge function connectivity');
    }
    if (summary.networkIssues > 0) {
      recommendations.push('Check network connectivity and DNS resolution');
    }
    if (summary.criticalErrors > 0) {
      recommendations.push('Address critical errors before allowing checkout');
    }

    const overallStatus = summary.criticalErrors > 0 ? 'CRITICAL' : 
                         summary.totalErrors > 2 ? 'DEGRADED' : 'HEALTHY';

    return {
      overallStatus,
      errors,
      summary,
      recommendations
    };
  }

  static formatAuditReport(report: CheckoutAuditReport): string {
    let output = `🔍 CHECKOUT ERROR AUDIT REPORT\n`;
    output += `═══════════════════════════════\n\n`;
    
    output += `📊 SUMMARY:\n`;
    output += `Status: ${report.overallStatus}\n`;
    output += `Total Errors: ${report.summary.totalErrors}\n`;
    output += `Critical Errors: ${report.summary.criticalErrors}\n`;
    output += `Network Issues: ${report.summary.networkIssues}\n`;
    output += `Edge Function Issues: ${report.summary.edgeFunctionIssues}\n\n`;

    if (report.errors.length > 0) {
      output += `🚨 ERRORS DETECTED:\n`;
      report.errors.forEach((error, index) => {
        output += `\n${index + 1}. ${error.errorType} - ${error.severity}\n`;
        output += `   Description: ${error.description}\n`;
        output += `   Recommendation: ${error.recommendation}\n`;
        output += `   Can Retry: ${error.canRetry ? 'Yes' : 'No'}\n`;
      });
    }

    if (report.recommendations.length > 0) {
      output += `\n💡 RECOMMENDATIONS:\n`;
      report.recommendations.forEach((rec, index) => {
        output += `${index + 1}. ${rec}\n`;
      });
    }

    return output;
  }
}