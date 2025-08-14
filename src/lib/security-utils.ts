import { supabase } from "@/integrations/supabase/client";

/**
 * Enhanced security utilities for production monitoring and threat detection
 * Updated with secure password handling and centralized auth validation
 */

export interface SecurityEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata?: Record<string, any>;
}

export interface SecureCustomerAuth {
  success: boolean;
  customer_id?: string;
  email_verified?: boolean;
  error?: string;
  details?: string[];
}

export interface RateLimitCheck {
  allowed: boolean;
  current_count: number;
  limit: number;
  reset_time: string;
  remaining?: number;
  retry_after_seconds?: number;
}

/**
 * Log security events for monitoring and incident response
 */
export async function logSecurityEvent(
  eventType: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  description: string,
  metadata: Record<string, any> = {}
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('log_security_event', {
      p_event_type: eventType,
      p_severity: severity,
      p_description: description,
      p_user_id: (await supabase.auth.getUser()).data.user?.id || null,
      p_ip_address: null, // Will be inferred server-side
      p_user_agent: navigator.userAgent,
      p_metadata: metadata
    });

    if (error) {
      console.error('Security event logging failed:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Security event logging error:', error);
    return null;
  }
}

/**
 * Check rate limits for various operations
 */
export async function checkRateLimit(
  identifier: string,
  limitType: string = 'general',
  maxRequests: number = 100,
  windowMinutes: number = 60
): Promise<RateLimitCheck | null> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_limit_type: limitType,
      p_max_requests: maxRequests,
      p_window_minutes: windowMinutes
    });

    if (error) {
      console.error('Rate limit check failed:', error);
      return null;
    }

    return data as unknown as RateLimitCheck;
  } catch (error) {
    console.error('Rate limit check error:', error);
    return null;
  }
}

/**
 * Validate admin permissions before sensitive operations
 */
export async function validateAdminPermissions(
  requiredPermission: string
): Promise<boolean> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      await logSecurityEvent(
        'unauthorized_access_attempt',
        'medium',
        'Non-authenticated user attempted admin operation',
        { required_permission: requiredPermission }
      );
      return false;
    }

    const { data, error } = await supabase.rpc('validate_admin_permissions', {
      p_user_id: user.user.id,
      p_required_permission: requiredPermission
    });

    if (error) {
      console.error('Permission validation failed:', error);
      return false;
    }

    return data as boolean;
  } catch (error) {
    console.error('Permission validation error:', error);
    return false;
  }
}

/**
 * Monitor API request performance and security
 */
export async function monitorAPIRequest(
  endpoint: string,
  method: string,
  responseTime: number,
  statusCode: number,
  errorDetails?: Record<string, any>
): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    
    await supabase.rpc('log_api_request', {
      p_endpoint: endpoint,
      p_method: method,
      p_response_time_ms: responseTime,
      p_response_status: statusCode,
      p_customer_id: user.user?.id || null,
      p_error_details: errorDetails || null
    });

    // Log slow requests as potential performance issues
    if (responseTime > 5000) {
      await logSecurityEvent(
        'slow_api_response',
        'medium',
        `Slow API response detected: ${endpoint}`,
        { 
          endpoint, 
          method, 
          response_time_ms: responseTime,
          status_code: statusCode 
        }
      );
    }

    // Log error responses as potential security issues
    if (statusCode >= 400) {
      await logSecurityEvent(
        'api_error_response',
        statusCode >= 500 ? 'high' : 'medium',
        `API error response: ${statusCode}`,
        { 
          endpoint, 
          method, 
          status_code: statusCode,
          error_details: errorDetails 
        }
      );
    }
  } catch (error) {
    console.error('API monitoring error:', error);
  }
}

/**
 * Detect and report suspicious user behavior
 */
export async function detectSuspiciousActivity(
  activityType: string,
  activityData: Record<string, any>
): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser();
    
    // Check for rapid successive requests
    if (activityType === 'rapid_requests') {
      const rateLimit = await checkRateLimit(
        user.user?.id || 'anonymous',
        'rapid_activity',
        10, // 10 requests
        1   // per minute
      );

      if (rateLimit && !rateLimit.allowed) {
        await logSecurityEvent(
          'suspicious_rapid_activity',
          'high',
          'User making rapid successive requests',
          { 
            user_id: user.user?.id,
            activity_type: activityType,
            rate_limit_data: rateLimit,
            ...activityData 
          }
        );
      }
    }

    // Check for unusual access patterns
    if (activityType === 'unusual_access') {
      await logSecurityEvent(
        'unusual_access_pattern',
        'medium',
        'Unusual user access pattern detected',
        { 
          user_id: user.user?.id,
          activity_type: activityType,
          ...activityData 
        }
      );
    }

    // Check for failed authentication attempts
    if (activityType === 'failed_auth') {
      await logSecurityEvent(
        'authentication_failure',
        'high',
        'Failed authentication attempt',
        { 
          user_id: user.user?.id,
          activity_type: activityType,
          ...activityData 
        }
      );
    }
  } catch (error) {
    console.error('Suspicious activity detection error:', error);
  }
}

/**
 * Security monitoring hook for React components
 */
export function useSecurityMonitoring() {
  const logEvent = async (
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    description: string,
    metadata: Record<string, any> = {}
  ) => {
    return await logSecurityEvent(eventType, severity, description, metadata);
  };

  const checkRates = async (
    identifier: string,
    limitType: string = 'general',
    maxRequests: number = 100,
    windowMinutes: number = 60
  ) => {
    return await checkRateLimit(identifier, limitType, maxRequests, windowMinutes);
  };

  const validatePermissions = async (requiredPermission: string) => {
    return await validateAdminPermissions(requiredPermission);
  };

  const monitorAPI = async (
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number,
    errorDetails?: Record<string, any>
  ) => {
    return await monitorAPIRequest(endpoint, method, responseTime, statusCode, errorDetails);
  };

  const detectActivity = async (
    activityType: string,
    activityData: Record<string, any>
  ) => {
    return await detectSuspiciousActivity(activityType, activityData);
  };

  return {
    logEvent,
    checkRates,
    validatePermissions,
    monitorAPI,
    detectActivity
  };
}

/**
 * Secure customer authentication functions using edge functions
 */
export async function secureCustomerAuth(
  action: 'register' | 'verify_otp' | 'check_rate_limit',
  params: {
    email: string;
    password?: string;
    name?: string;
    phone?: string;
    otpCode?: string;
  }
): Promise<SecureCustomerAuth> {
  try {
    const { data, error } = await supabase.functions.invoke('secure-customer-auth', {
      body: {
        action,
        ...params
      }
    });

    if (error) {
      console.error('Secure customer auth error:', error);
      return {
        success: false,
        error: 'Authentication service error'
      };
    }

    return data;
  } catch (error) {
    console.error('Secure customer auth exception:', error);
    return {
      success: false,
      error: 'Network error during authentication'
    };
  }
}

/**
 * Check OTP rate limit using secure function
 */
export async function checkOTPRateLimit(email: string): Promise<{
  allowed: boolean;
  remaining?: number;
  retry_after_seconds?: number;
  reason?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('check_otp_rate_limit_secure', {
      p_email: email
    });

    if (error) {
      console.error('OTP rate limit check failed:', error);
      return { allowed: false, reason: 'Rate limit check failed' };
    }

    return data as {
      allowed: boolean;
      remaining?: number;
      retry_after_seconds?: number;
      reason?: string;
    };
  } catch (error) {
    console.error('OTP rate limit check error:', error);
    return { allowed: false, reason: 'Network error' };
  }
}

/**
 * Validate admin access using centralized secure function
 */
export async function validateSecureAdminAccess(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('validate_admin_access');

    if (error) {
      console.error('Admin access validation failed:', error);
      return false;
    }

    return data as boolean;
  } catch (error) {
    console.error('Admin access validation error:', error);
    return false;
  }
}

/**
 * Security context for application-wide monitoring
 */
export const SecurityMonitor = {
  logEvent: logSecurityEvent,
  checkRateLimit,
  validateAdminPermissions,
  monitorAPIRequest,
  detectSuspiciousActivity,
  secureCustomerAuth,
  checkOTPRateLimit,
  validateSecureAdminAccess
};