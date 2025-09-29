import { supabase } from '@/integrations/supabase/client';

export interface AuthAuditEvent {
  action: string;
  category: 'Authentication' | 'Authorization' | 'Security';
  message: string;
  user_id?: string;
  user_email?: string;
  metadata?: Record<string, any>;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Enhanced authentication audit logger for security monitoring
 * Logs authentication events with proper error handling
 */
export class AuthAuditLogger {
  static async logEvent(event: AuthAuditEvent): Promise<void> {
    try {
      const auditLog = {
        action: event.action,
        category: event.category,
        message: event.message,
        user_id: event.user_id || null,
        new_values: {
          user_email: event.user_email,
          severity: event.severity || 'info',
          timestamp: new Date().toISOString(),
          ...event.metadata
        }
      };

      const { error } = await supabase
        .from('audit_logs')
        .insert(auditLog);

      if (error) {
        // Fallback: log to console if database logging fails
        console.warn('Failed to log audit event:', error, auditLog);
      }
    } catch (err) {
      // Silent failure for audit logging to prevent disrupting user experience
      console.warn('Audit logging error:', err);
    }
  }

  static async logLogin(userId: string, email: string, success: boolean, error?: string): Promise<void> {
    await this.logEvent({
      action: success ? 'user_login_success' : 'user_login_failed',
      category: 'Authentication',
      message: success 
        ? `User ${email} logged in successfully` 
        : `Login failed for ${email}: ${error}`,
      user_id: success ? userId : undefined,
      user_email: email,
      severity: success ? 'info' : 'warning',
      metadata: { error }
    });
  }

  static async logLogout(userId: string, email: string): Promise<void> {
    await this.logEvent({
      action: 'user_logout',
      category: 'Authentication',
      message: `User ${email} logged out`,
      user_id: userId,
      user_email: email,
      severity: 'info'
    });
  }

  static async logPermissionCheck(userId: string, email: string, menuKey: string, granted: boolean): Promise<void> {
    await this.logEvent({
      action: 'permission_check',
      category: 'Authorization',
      message: `Permission ${granted ? 'granted' : 'denied'} for ${email} on ${menuKey}`,
      user_id: userId,
      user_email: email,
      severity: granted ? 'info' : 'warning',
      metadata: { menu_key: menuKey, granted }
    });
  }

  static async logAdminAccess(userId: string, email: string, action: string): Promise<void> {
    await this.logEvent({
      action: 'admin_access',
      category: 'Security',
      message: `Admin access by ${email}: ${action}`,
      user_id: userId,
      user_email: email,
      severity: 'info',
      metadata: { admin_action: action }
    });
  }

  static async logSecurityEvent(email: string, event: string, severity: 'warning' | 'error' | 'critical' = 'warning'): Promise<void> {
    await this.logEvent({
      action: 'security_event',
      category: 'Security',
      message: `Security event for ${email}: ${event}`,
      user_email: email,
      severity,
      metadata: { security_event: event }
    });
  }

  static async logToolbuxAccess(action: string, metadata?: Record<string, any>): Promise<void> {
    await this.logEvent({
      action: 'toolbux_admin_access',
      category: 'Security',
      message: `ToolBux admin access: ${action}`,
      user_email: 'toolbuxdev@gmail.com',
      severity: 'info',
      metadata: { guaranteed_admin: true, ...metadata }
    });
  }
}