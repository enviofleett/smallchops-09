import { toast } from 'sonner';

interface ImportCache {
  [key: string]: any;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  exponentialBackoff: boolean;
}

class ErrorSafeImportManager {
  private cache: ImportCache = {};
  private failedImports: Set<string> = new Set();
  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    exponentialBackoff: true
  };

  /**
   * Error-safe dynamic import with fallbacks and caching
   */
  async safeImport<T = any>(
    importPath: string,
    fallback?: T,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T | null> {
    // Return cached module if available
    if (this.cache[importPath]) {
      return this.cache[importPath];
    }

    // Skip if previously failed and no fallback
    if (this.failedImports.has(importPath) && !fallback) {
      console.warn(`⚠️ Skipping previously failed import: ${importPath}`);
      return null;
    }

    const config = { ...this.defaultRetryConfig, ...retryConfig };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        // Add delay for retries
        if (attempt > 0) {
          const delay = config.exponentialBackoff 
            ? config.baseDelay * Math.pow(2, attempt - 1)
            : config.baseDelay;
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const module = await import(importPath);
        
        // Cache successful import
        this.cache[importPath] = module;
        this.failedImports.delete(importPath);
        
        if (attempt > 0) {
          console.log(`✅ Import recovered after ${attempt} retries: ${importPath}`);
        }
        
        return module;
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Import attempt ${attempt + 1} failed for ${importPath}:`, error);
      }
    }

    // Mark as failed
    this.failedImports.add(importPath);
    
    // Return fallback if available
    if (fallback) {
      console.log(`🔄 Using fallback for failed import: ${importPath}`);
      return fallback;
    }

    console.error(`💀 All import attempts failed for ${importPath}:`, lastError);
    return null;
  }

  /**
   * Safe admin toast messages with fallback
   */
  async safeAdminToast(
    toastFn: typeof toast,
    messageType: string,
    options: any = {}
  ): Promise<void> {
    try {
      const adminToastMessages = await this.safeImport('@/utils/adminToastMessages');
      
      if (adminToastMessages?.showAdminToast) {
        adminToastMessages.showAdminToast(toastFn, messageType, options);
      } else {
        throw new Error('showAdminToast not available');
      }
    } catch (error) {
      // Fallback to basic toast messages
      this.fallbackToast(toastFn, messageType, options);
    }
  }

  /**
   * Safe admin error toast with fallback
   */
  async safeAdminErrorToast(
    toastFn: typeof toast,
    error: any,
    options: any = {}
  ): Promise<void> {
    try {
      const adminToastMessages = await this.safeImport('@/utils/adminToastMessages');
      
      if (adminToastMessages?.showAdminErrorToast) {
        adminToastMessages.showAdminErrorToast(toastFn, error, options);
      } else {
        throw new Error('showAdminErrorToast not available');
      }
    } catch (importError) {
      // Fallback to basic error toast
      this.fallbackErrorToast(toastFn, error, options);
    }
  }

  /**
   * Fallback toast implementation
   */
  private fallbackToast(toastFn: typeof toast, messageType: string, options: any): void {
    const fallbackMessages: Record<string, any> = {
      orderUpdated: {
        title: 'Order Updated',
        description: `Order ${options.orderId || ''} has been updated successfully`,
        variant: 'default'
      },
      cacheBypassSuccess: {
        title: 'Cache Bypass Successful',
        description: `Order ${options.orderId || ''} updated via cache bypass`,
        variant: 'default'
      },
      networkError: {
        title: 'Network Error',
        description: 'Please check your connection and try again',
        variant: 'destructive'
      },
      serverError: {
        title: 'Server Error',
        description: 'An unexpected error occurred. Please try again',
        variant: 'destructive'
      }
    };

    const message = fallbackMessages[messageType] || {
      title: 'Operation Complete',
      description: 'Action completed',
      variant: 'default'
    };

    toastFn(message.title, {
      description: message.description
    });
  }

  /**
   * Fallback error toast implementation
   */
  private fallbackErrorToast(toastFn: typeof toast, error: any, options: any): void {
    const errorMessage = error?.message || 'An unexpected error occurred';
    let title = 'Error';
    let description = errorMessage;

    // Categorize common errors
    if (errorMessage.includes('409') || errorMessage.includes('CONCURRENT_UPDATE')) {
      title = 'Update Conflict';
      description = 'Another admin is updating this order. Please wait and try again.';
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      title = 'Network Error';
      description = 'Connection issue. Please check your network and try again.';
    } else if (errorMessage.includes('timeout')) {
      title = 'Request Timeout';
      description = 'The operation took too long. Please try again.';
    }

    toastFn(title, {
      description,
      action: options.onRetry ? {
        label: 'Retry',
        onClick: options.onRetry
      } : undefined
    });
  }

  /**
   * Clear failed imports cache (for recovery)
   */
  clearFailedImports(): void {
    this.failedImports.clear();
    console.log('🧹 Cleared failed imports cache');
  }

  /**
   * Get import statistics
   */
  getStats(): { cached: number; failed: number; } {
    return {
      cached: Object.keys(this.cache).length,
      failed: this.failedImports.size
    };
  }
}

// Export singleton instance
export const errorSafeImports = new ErrorSafeImportManager();

// Convenience functions
export const safeImport = errorSafeImports.safeImport.bind(errorSafeImports);
export const safeAdminToast = errorSafeImports.safeAdminToast.bind(errorSafeImports);
export const safeAdminErrorToast = errorSafeImports.safeAdminErrorToast.bind(errorSafeImports);