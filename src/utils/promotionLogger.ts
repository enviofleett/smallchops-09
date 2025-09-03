/**
 * PRODUCTION UTILITY: Promotion Activity Logger
 * Comprehensive logging for promotion management activities
 */

import { logAdminActivity } from './adminActivityLogger';

export interface PromotionLogContext {
  promotionId?: string;
  promotionName?: string;
  promotionType?: string;
  action: string;
  details?: Record<string, any>;
  error?: Error | string;
}

/**
 * Log promotion-related activities for audit trail
 */
export class PromotionLogger {
  
  /**
   * Log promotion creation
   */
  static async logCreation(context: {
    promotionData: any;
    success: boolean;
    error?: Error | string;
  }): Promise<void> {
    try {
      await logAdminActivity({
        action: context.success ? 'promotion_created' : 'promotion_creation_failed',
        category: 'Promotion Management',
        entityType: 'promotions',
        entityId: context.promotionData?.id,
        message: context.success 
          ? `Created promotion: ${context.promotionData?.name}`
          : `Failed to create promotion: ${context.error}`,
        newValues: context.success ? {
          name: context.promotionData?.name,
          type: context.promotionData?.type,
          value: context.promotionData?.value,
          code: context.promotionData?.code
        } : undefined,
        metadata: {
          success: context.success,
          error: context.error?.toString(),
          promotionType: context.promotionData?.type
        }
      });
    } catch (error) {
      console.error('Failed to log promotion creation:', error);
    }
  }

  /**
   * Log promotion validation failures
   */
  static async logValidationError(context: {
    promotionData: any;
    validationErrors: string[];
  }): Promise<void> {
    try {
      await logAdminActivity({
        action: 'promotion_validation_failed',
        category: 'Promotion Management',
        message: `Promotion validation failed: ${context.validationErrors.join(', ')}`,
        newValues: {
          promotionName: context.promotionData?.name,
          errors: context.validationErrors,
          formData: context.promotionData
        },
        metadata: {
          errorCount: context.validationErrors.length,
          promotionType: context.promotionData?.type
        }
      });
    } catch (error) {
      console.error('Failed to log validation error:', error);
    }
  }

  /**
   * Log form interaction events for UX analysis
   */
  static logFormInteraction(event: {
    field: string;
    action: 'focus' | 'blur' | 'change' | 'error';
    value?: any;
    error?: string;
  }): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('Promotion Form Interaction:', {
        timestamp: new Date().toISOString(),
        ...event
      });
    }
  }

  /**
   * Log performance metrics
   */
  static logPerformance(metric: {
    operation: string;
    duration: number;
    success: boolean;
  }): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('Promotion Performance:', {
        timestamp: new Date().toISOString(),
        ...metric
      });
    }
  }
}

/**
 * Production error handler for promotion operations
 */
export function handlePromotionError(error: any, context?: string): string {
  let errorMessage = 'An unexpected error occurred';
  
  if (error?.message) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error?.toString) {
    errorMessage = error.toString();
  }

  // Log error for debugging
  console.error('Promotion Error:', {
    context,
    error,
    message: errorMessage,
    timestamp: new Date().toISOString()
  });

  // Return user-friendly message
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return 'Network connection issue. Please check your internet and try again.';
  }
  
  if (errorMessage.includes('unauthorized') || errorMessage.includes('permission')) {
    return 'You do not have permission to perform this action.';
  }
  
  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return 'Please check your input and try again.';
  }
  
  if (errorMessage.includes('exists') || errorMessage.includes('duplicate')) {
    return 'A promotion with this code already exists. Please use a different code.';
  }

  return errorMessage;
}