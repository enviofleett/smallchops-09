import { supabase } from '@/integrations/supabase/client';

interface ErrorReport {
  function_name: string;
  error_type: string;
  error_message: string;
  stack_trace?: string;
  request_details?: any;
  timestamp: string;
  user_id?: string;
}

class ProductionErrorReporter {
  private static instance: ProductionErrorReporter;
  private errorQueue: ErrorReport[] = [];
  private isProcessing = false;

  private constructor() {}

  static getInstance(): ProductionErrorReporter {
    if (!ProductionErrorReporter.instance) {
      ProductionErrorReporter.instance = new ProductionErrorReporter();
    }
    return ProductionErrorReporter.instance;
  }

  async reportError(
    functionName: string,
    errorType: string,
    error: Error | string,
    requestDetails?: any,
    userId?: string
  ) {
    const errorReport: ErrorReport = {
      function_name: functionName,
      error_type: errorType,
      error_message: typeof error === 'string' ? error : error.message,
      stack_trace: typeof error === 'object' ? error.stack : undefined,
      request_details: requestDetails,
      timestamp: new Date().toISOString(),
      user_id: userId
    };

    // Add to queue for batch processing
    this.errorQueue.push(errorReport);
    
    // Process immediately for critical errors
    const criticalErrors = [
      'AUTH_SYSTEM_DOWN',
      'DATABASE_CONNECTION_FAILED', 
      'PAYMENT_PROCESSING_FAILED',
      'ORDER_CREATION_FAILED'
    ];

    if (criticalErrors.includes(errorType)) {
      await this.processSingleError(errorReport);
    } else {
      // Process in batch for non-critical errors
      this.scheduleProcessing();
    }
  }

  private async processSingleError(errorReport: ErrorReport) {
    try {
      const { error } = await supabase.functions.invoke('production-error-handler', {
        body: errorReport
      });

      if (error) {
        console.error('Failed to report production error:', error);
        // Store locally as fallback
        this.storeErrorLocally(errorReport);
      } else {
        console.log('✅ Production error reported successfully');
      }
    } catch (error) {
      console.error('Error reporting system failure:', error);
      this.storeErrorLocally(errorReport);
    }
  }

  private scheduleProcessing() {
    if (this.isProcessing || this.errorQueue.length === 0) {
      return;
    }

    // Process errors in batches every 30 seconds
    setTimeout(() => {
      this.processBatch();
    }, 30000);
  }

  private async processBatch() {
    if (this.isProcessing || this.errorQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batch = this.errorQueue.splice(0, 10); // Process up to 10 errors at once

    try {
      for (const errorReport of batch) {
        await this.processSingleError(errorReport);
        // Small delay between reports to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Batch error processing failed:', error);
    } finally {
      this.isProcessing = false;
      
      // Continue processing if there are more errors
      if (this.errorQueue.length > 0) {
        this.scheduleProcessing();
      }
    }
  }

  private storeErrorLocally(errorReport: ErrorReport) {
    try {
      const stored = localStorage.getItem('production_errors');
      const errors = stored ? JSON.parse(stored) : [];
      errors.push(errorReport);
      
      // Keep only last 50 errors to prevent storage bloat
      if (errors.length > 50) {
        errors.splice(0, errors.length - 50);
      }
      
      localStorage.setItem('production_errors', JSON.stringify(errors));
    } catch (error) {
      console.error('Failed to store error locally:', error);
    }
  }

  // Method to retry failed errors from local storage
  async retryStoredErrors() {
    try {
      const stored = localStorage.getItem('production_errors');
      if (!stored) return;

      const errors: ErrorReport[] = JSON.parse(stored);
      
      for (const errorReport of errors) {
        await this.processSingleError(errorReport);
      }

      // Clear stored errors after successful retry
      localStorage.removeItem('production_errors');
      console.log('✅ Retried stored production errors successfully');
    } catch (error) {
      console.error('Failed to retry stored errors:', error);
    }
  }
}

// Export singleton instance
export const productionErrorReporter = ProductionErrorReporter.getInstance();

// Auto-retry stored errors on app startup
if (typeof window !== 'undefined') {
  setTimeout(() => {
    productionErrorReporter.retryStoredErrors();
  }, 5000);
}
