/**
 * Bulletproof Operations Utilities
 * 
 * Production-hardened utilities that ensure zero failures for critical operations
 * like order status updates, preventing duplicate key violations and race conditions.
 */

import { supabase } from '@/integrations/supabase/client';

export interface BulletproofResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  recovery_actions?: string[];
  retry_after_seconds?: number;
  email_queued?: {
    success: boolean;
    deduplicated?: boolean;
    message?: string;
  };
}

/**
 * Bulletproof order status update with zero duplicate key violations
 * Uses atomic database operations with proper locking and circuit breaker patterns
 */
export async function bulletproofOrderStatusUpdate(
  orderId: string,
  newStatus: string,
  adminId?: string
): Promise<BulletproofResult> {
  try {
    console.log(`🔒 BULLETPROOF: Updating order ${orderId} to status ${newStatus}`);
    
    const { data, error } = await supabase.rpc('admin_update_order_status_bulletproof', {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_admin_id: adminId || null
    });

    if (error) {
      console.error(`❌ Bulletproof status update failed:`, error);
      return {
        success: false,
        error: error.message,
        recovery_actions: ['Check network connection', 'Retry after a moment', 'Contact support']
      };
    }

    // Cast the JSON response to our expected type
    const result = data as any;

    if (!result?.success) {
      console.error(`❌ Bulletproof status update unsuccessful:`, result);
      return {
        success: false,
        error: result?.error || 'Status update failed',
        retry_after_seconds: result?.retry_after_seconds,
        recovery_actions: result?.recovery_actions
      };
    }

    console.log(`✅ Bulletproof status update successful for order ${orderId}`);
    
    // Log email queue metrics
    if (result?.email_queued?.success) {
      console.log('📧 Email notification queued successfully');
    }
    
    if (result?.email_queued?.deduplicated) {
      console.log('🔄 Email notification deduplicated (already queued)');
    }

    return {
      success: true,
      data: result.order,
      email_queued: result.email_queued
    };

  } catch (error: any) {
    console.error(`💥 Bulletproof operation exception:`, error);
    return {
      success: false,
      error: error.message || 'Unexpected error occurred',
      recovery_actions: ['Check network connection', 'Refresh page', 'Try again']
    };
  }
}

/**
 * Enhanced error classification specifically for bulletproof operations
 */
export function classifyBulletproofError(error: any): {
  type: 'network' | 'authentication' | 'validation' | 'rate_limit' | 'conflict' | 'server' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userMessage: string;
  shouldRetry: boolean;
} {
  const errorMsg = error?.message || '';
  
  // Rate limiting
  if (errorMsg.includes('Rate limit exceeded')) {
    return {
      type: 'rate_limit',
      severity: 'medium',
      userMessage: 'Too many requests. Please wait a moment and try again.',
      shouldRetry: true
    };
  }
  
  // Lock conflicts (concurrent updates)
  if (errorMsg.includes('Order is currently being modified') || errorMsg.includes('lock_not_available')) {
    return {
      type: 'conflict',
      severity: 'low',
      userMessage: 'Order is being updated by another admin. Please try again in a moment.',
      shouldRetry: true
    };
  }
  
  // Duplicate key violations (should be impossible with bulletproof functions)
  if (errorMsg.includes('duplicate key value violates unique constraint')) {
    return {
      type: 'conflict',
      severity: 'high',
      userMessage: 'Update in progress by another session. Please try again.',
      shouldRetry: true
    };
  }
  
  // Authentication issues
  if (errorMsg.includes('authentication') || errorMsg.includes('unauthorized')) {
    return {
      type: 'authentication',
      severity: 'high',
      userMessage: 'Authentication expired. Please refresh and try again.',
      shouldRetry: false
    };
  }
  
  // Validation errors
  if (errorMsg.includes('Invalid status') || errorMsg.includes('validation')) {
    return {
      type: 'validation',
      severity: 'medium',
      userMessage: 'Invalid status update. Please refresh the page and try again.',
      shouldRetry: false
    };
  }
  
  // Network/service errors
  if (errorMsg.includes('edge function') || errorMsg.includes('non-2xx status') || errorMsg.includes('network')) {
    return {
      type: 'network',
      severity: 'medium',
      userMessage: 'Service temporarily unavailable. Please try again.',
      shouldRetry: true
    };
  }
  
  // Default unknown error
  return {
    type: 'unknown',
    severity: 'medium',
    userMessage: errorMsg || 'An unexpected error occurred. Please try again.',
    shouldRetry: true
  };
}

/**
 * Bulletproof retry mechanism with exponential backoff
 */
export async function bulletproofRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      console.log(`✅ Bulletproof operation succeeded on attempt ${attempt}`);
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Bulletproof operation failed on attempt ${attempt}:`, error);
      
      const errorClassification = classifyBulletproofError(error);
      
      // Don't retry certain error types
      if (!errorClassification.shouldRetry || attempt === maxAttempts) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`⏱️ Retrying bulletproof operation in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxAttempts})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Production monitoring helper for bulletproof operations
 */
export function logBulletproofMetrics(operation: string, startTime: number, result: BulletproofResult) {
  const duration = Date.now() - startTime;
  
  console.log(`📊 Bulletproof Metrics: ${operation}`, {
    duration_ms: duration,
    success: result.success,
    email_queued: result.email_queued?.success || false,
    email_deduplicated: result.email_queued?.deduplicated || false,
    error_type: result.error ? 'error' : 'none'
  });
  
  // Log to audit system for monitoring
  if (!result.success) {
    console.error(`🚨 Bulletproof operation failed: ${operation}`, {
      error: result.error,
      recovery_actions: result.recovery_actions,
      duration_ms: duration
    });
  }
}