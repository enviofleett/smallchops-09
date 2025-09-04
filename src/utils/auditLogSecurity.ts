import { sanitizeText } from './htmlSanitizer';
import { SecurityMonitor } from '@/lib/security-utils';

/**
 * Production-grade security utilities for audit log display
 * Addresses XSS, data validation, and sensitive information handling
 */

// Define allowed audit log actions for validation
const ALLOWED_AUDIT_ACTIONS = [
  // Authentication & Session Management
  'login', 'logout', 'session_created', 'session_expired', 'admin_login', 'admin_logout',
  'password_change', 'password_reset', 'two_factor_enabled', 'two_factor_disabled',
  
  // User & Customer Management  
  'customer_created', 'customer_updated', 'customer_deleted', 'customer_activated', 'customer_deactivated',
  'admin_user_created', 'admin_user_updated', 'admin_user_deleted', 'admin_user_activated', 'admin_user_deactivated',
  
  // Order & Payment Management
  'order_created', 'order_updated', 'order_cancelled', 'order_completed', 'order_refunded',
  'payment_processed', 'payment_failed', 'payment_refunded', 'payment_updated',
  
  // Product & Inventory Management
  'product_created', 'product_updated', 'product_deleted', 'product_activated', 'product_deactivated',
  'category_created', 'category_updated', 'category_deleted',
  'inventory_updated', 'stock_alert', 'moq_violation',
  
  // System & Configuration
  'settings_updated', 'configuration_changed', 'system_maintenance', 'backup_created',
  'email_sent', 'email_failed', 'notification_sent',
  
  // Security & Audit
  'unauthorized_access_attempt', 'permission_denied', 'security_event', 'audit_log_accessed',
  'suspicious_activity_detected', 'rate_limit_exceeded', 'data_export', 'data_import',
  
  // Business Operations
  'promotion_created', 'promotion_updated', 'promotion_deleted', 'promotion_activated', 'promotion_deactivated',
  'delivery_scheduled', 'delivery_completed', 'delivery_failed', 'rider_assigned',
  
  // Communication
  'email_template_updated', 'smtp_configuration_updated', 'communication_settings_changed',
  
  // Generic fallback
  'system_operation', 'admin_operation', 'automated_process'
] as const;

type AuditAction = typeof ALLOWED_AUDIT_ACTIONS[number];

export interface SecureAuditLogRow {
  id: string;
  event_time: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  category: string | null;
  entity_type: string | null;
  entity_id: string | null;
  message: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  user_agent: string | null;
  admin_profile?: {
    id: string;
    email: string;
    role: string;
    is_active: boolean;
  };
}

/**
 * Validates and sanitizes audit log action
 */
export function sanitizeAuditAction(action: string): string {
  if (!action || typeof action !== 'string') {
    return 'unknown_action';
  }

  // Sanitize the action string
  const sanitized = sanitizeText(action).toLowerCase().trim();
  
  // Validate against allowed actions
  if (ALLOWED_AUDIT_ACTIONS.includes(sanitized as AuditAction)) {
    return sanitized;
  }
  
  // Log potential security issue for unknown actions
  SecurityMonitor.logEvent(
    'unknown_audit_action',
    'medium',
    `Unknown audit action detected: ${action}`,
    { original_action: action, sanitized_action: sanitized }
  );
  
  return 'unknown_action';
}

/**
 * Sanitizes audit log message for safe display
 */
export function sanitizeAuditMessage(message: string | null): string {
  if (!message || typeof message !== 'string') {
    return '';
  }
  
  // Remove potential XSS content and limit length
  const sanitized = sanitizeText(message);
  
  // Limit message length for UI display
  const maxLength = 500;
  if (sanitized.length > maxLength) {
    return sanitized.substring(0, maxLength) + '...';
  }
  
  return sanitized;
}

/**
 * Sanitizes category for display
 */
export function sanitizeAuditCategory(category: string | null): string {
  if (!category || typeof category !== 'string') {
    return '';
  }
  
  return sanitizeText(category).toLowerCase().trim();
}

/**
 * Sanitizes entity type for display
 */
export function sanitizeEntityType(entityType: string | null): string {
  if (!entityType || typeof entityType !== 'string') {
    return '';
  }
  
  return sanitizeText(entityType).toLowerCase().trim();
}

/**
 * Enhanced IP address masking for privacy compliance
 */
export function maskIPAddress(ipAddress: string | null): string {
  if (!ipAddress || typeof ipAddress !== 'string') {
    return '-';
  }
  
  // IPv4 masking: 192.168.xxx.xxx
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = ipAddress.match(ipv4Regex);
  if (ipv4Match) {
    return `${ipv4Match[1]}.${ipv4Match[2]}.xxx.xxx`;
  }
  
  // IPv6 masking: 2001:db8:xxxx::xxxx
  const ipv6Regex = /^([a-f0-9]{1,4}):([a-f0-9]{1,4}):/i;
  const ipv6Match = ipAddress.match(ipv6Regex);
  if (ipv6Match) {
    return `${ipv6Match[1]}:${ipv6Match[2]}:xxxx::xxxx`;
  }
  
  // Fallback: mask everything except first 3 characters
  if (ipAddress.length > 6) {
    return ipAddress.substring(0, 3) + 'xxx.xxx';
  }
  
  return 'xxx.xxx';
}

/**
 * Sanitizes user agent string to prevent information leakage
 */
export function sanitizeUserAgent(userAgent: string | null): string {
  if (!userAgent || typeof userAgent !== 'string') {
    return '';
  }
  
  // Remove potential sensitive information and limit length
  const sanitized = sanitizeText(userAgent);
  const maxLength = 100;
  
  if (sanitized.length > maxLength) {
    return sanitized.substring(0, maxLength) + '...';
  }
  
  return sanitized;
}

/**
 * Securely processes audit log data for display
 */
export function secureAuditLogData(log: SecureAuditLogRow): SecureAuditLogRow {
  return {
    ...log,
    action: sanitizeAuditAction(log.action),
    category: sanitizeAuditCategory(log.category),
    entity_type: sanitizeEntityType(log.entity_type),
    message: sanitizeAuditMessage(log.message),
    ip_address: maskIPAddress(log.ip_address),
    user_agent: sanitizeUserAgent(log.user_agent),
    // Ensure sensitive data is properly handled
    old_values: null, // Don't expose sensitive old values in UI
    new_values: null, // Don't expose sensitive new values in UI
  };
}

/**
 * Validates search filters to prevent injection attacks
 */
export function sanitizeSearchFilters(filters: {
  category: string;
  user: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}) {
  return {
    category: sanitizeText(filters.category || '').toLowerCase().trim(),
    user: sanitizeText(filters.user || '').trim(),
    dateFrom: sanitizeText(filters.dateFrom || '').trim(),
    dateTo: sanitizeText(filters.dateTo || '').trim(),
    search: sanitizeText(filters.search || '').trim().substring(0, 100), // Limit search length
  };
}

/**
 * Rate limit configuration for audit log queries
 */
export const AUDIT_LOG_RATE_LIMITS = {
  MAX_REQUESTS_PER_MINUTE: 30,
  MAX_REQUESTS_PER_HOUR: 200,
  COOLDOWN_AFTER_LIMIT: 60000, // 1 minute cooldown
} as const;

/**
 * Check rate limit for audit log access
 */
export async function checkAuditLogRateLimit(userId: string | null): Promise<{
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
}> {
  const identifier = userId || 'anonymous';
  
  try {
    // Check minute rate limit
    const minuteCheck = await SecurityMonitor.checkRateLimit(
      identifier,
      'audit_log_minute',
      AUDIT_LOG_RATE_LIMITS.MAX_REQUESTS_PER_MINUTE,
      1
    );
    
    if (minuteCheck && !minuteCheck.allowed) {
      await SecurityMonitor.logEvent(
        'audit_log_rate_limit_exceeded',
        'medium',
        `Audit log rate limit exceeded for user: ${identifier}`,
        { limit_type: 'minute', user_id: userId }
      );
      
      return {
        allowed: false,
        reason: 'Rate limit exceeded (per minute)',
        retryAfter: 60
      };
    }
    
    // Check hourly rate limit
    const hourCheck = await SecurityMonitor.checkRateLimit(
      identifier,
      'audit_log_hour',
      AUDIT_LOG_RATE_LIMITS.MAX_REQUESTS_PER_HOUR,
      60
    );
    
    if (hourCheck && !hourCheck.allowed) {
      await SecurityMonitor.logEvent(
        'audit_log_rate_limit_exceeded',
        'high',
        `Audit log hourly rate limit exceeded for user: ${identifier}`,
        { limit_type: 'hour', user_id: userId }
      );
      
      return {
        allowed: false,
        reason: 'Rate limit exceeded (per hour)',
        retryAfter: 3600
      };
    }
    
    return { allowed: true };
    
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Allow access on rate limit check failure to avoid blocking legitimate users
    return { allowed: true };
  }
}

/**
 * Log audit log access for monitoring
 */
export async function logAuditLogAccess(
  userId: string | null,
  filters: any,
  resultCount: number
): Promise<void> {
  try {
    await SecurityMonitor.logEvent(
      'audit_log_accessed',
      'low',
      `Audit log accessed with ${resultCount} results`,
      {
        user_id: userId,
        filters: sanitizeSearchFilters(filters),
        result_count: resultCount,
        timestamp: new Date().toISOString()
      }
    );
  } catch (error) {
    console.error('Failed to log audit log access:', error);
  }
}